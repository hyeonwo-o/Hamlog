import { randomUUID } from 'node:crypto';
import { readCategories, writeCategories } from '../models/categoryModel.js';
import {
  detachChildCategories,
  findCategoryByIdentifier,
  isDefaultCategoryName,
  resolveCategoryUpdate,
  validateCategoryCreate,
  validateCategoryReorder
} from './category/categoryHelpers.js';
import {
  moveCategoryPostsToDefault,
  replaceCategoryInPosts
} from './category/categoryPostSync.js';
import { runWithDataStoreLock } from '../utils/storeLock.js';

async function createCategoryInternal(name, parentId) {
  const categories = await readCategories();
  const validation = validateCategoryCreate(categories, name, parentId);

  if (!validation.valid) {
    return { created: false, reason: validation.reason };
  }

  const newCategory = {
    id: randomUUID(),
    name: validation.normalizedName,
    parentId: validation.normalizedParentId,
    order: validation.order
  };

  const nextCategories = [...categories, newCategory];
  await writeCategories(nextCategories);

  return { categories: nextCategories, created: true, category: newCategory };
}

async function reorderCategoriesInternal(parentId, orderedIds) {
  const categories = await readCategories();
  const validation = validateCategoryReorder(categories, parentId, orderedIds);

  if (!validation.valid) {
    return { updated: false, reason: validation.reason };
  }

  const nextCategories = categories.map(category => {
    if (!validation.nextOrderMap.has(category.id)) {
      return category;
    }
    return { ...category, order: validation.nextOrderMap.get(category.id) };
  });

  const saved = await writeCategories(nextCategories);
  return { updated: true, categories: saved };
}

async function removeCategoryInternal(categoryIdentifier) {
  const categories = await readCategories();
  const target = findCategoryByIdentifier(categories, categoryIdentifier);

  if (!target || isDefaultCategoryName(target.name)) {
    return { categories, reassignedCount: 0, removed: false, reparentedCount: 0 };
  }

  const filteredCategories = categories.filter(category => category.id !== target.id);
  const { nextCategories, reparentedCount } = detachChildCategories(
    filteredCategories,
    target.id
  );
  const savedCategories = await writeCategories(nextCategories);
  const reassignedCount = await moveCategoryPostsToDefault(target.name);

  return { categories: savedCategories, reassignedCount, removed: true, reparentedCount };
}

async function updateCategoryInternal(id, updates) {
  const categories = await readCategories();
  const resolution = resolveCategoryUpdate(categories, id, updates);

  if (!resolution.valid) {
    return { categories, updated: false, reason: resolution.reason };
  }

  const nextCategories = [...categories];
  nextCategories[resolution.targetIndex] = {
    ...resolution.target,
    name: resolution.nextName,
    parentId: resolution.nextParentId,
    order: resolution.nextOrder
  };

  const savedCategories = await writeCategories(nextCategories);
  const reassignedCount = resolution.nameChanged
    ? await replaceCategoryInPosts(resolution.target.name, resolution.nextName)
    : 0;

  return {
    categories: savedCategories,
    updated: true,
    reassignedCount,
    previousName: resolution.target.name,
    nextName: resolution.nextName
  };
}

export async function createCategory(name, parentId) {
  return runWithDataStoreLock(() => createCategoryInternal(name, parentId));
}

export async function reorderCategories(parentId, orderedIds) {
  return runWithDataStoreLock(() => reorderCategoriesInternal(parentId, orderedIds));
}

export async function removeCategory(categoryIdentifier) {
  return runWithDataStoreLock(() => removeCategoryInternal(categoryIdentifier));
}

export async function updateCategory(id, updates) {
  return runWithDataStoreLock(() => updateCategoryInternal(id, updates));
}

export {
  createCategoryInternal as createCategoryUnlocked,
  reorderCategoriesInternal as reorderCategoriesUnlocked,
  removeCategoryInternal as removeCategoryUnlocked,
  updateCategoryInternal as updateCategoryUnlocked
};
