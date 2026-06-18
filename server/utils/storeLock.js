let mutationQueue = Promise.resolve();

export function runWithDataStoreLock(task) {
    const queued = mutationQueue.then(task, task);
    mutationQueue = queued.catch(() => { });
    return queued;
}
