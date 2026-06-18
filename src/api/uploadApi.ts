import { requestJson } from './client';

interface UploadResponse {
  url: string;
  filename: string;
}

export interface UploadFileInfo {
  filename: string;
  url: string;
  size: number;
  modifiedAt: string;
}

export interface UnusedUploadsResponse {
  totalFiles: number;
  totalBytes: number;
  referencedFiles: number;
  unused: UploadFileInfo[];
  unusedBytes: number;
}

export interface DeleteUnusedUploadsResponse {
  deleted: UploadFileInfo[];
  deletedBytes: number;
  remainingUnused: UploadFileInfo[];
}

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });

export async function uploadLocalImage(file: File): Promise<UploadResponse> {
  const dataUrl = await fileToDataUrl(file);
  return requestJson<UploadResponse>('/uploads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      dataUrl,
      filename: file.name
    })
  });
}

export async function fetchUnusedUploads(): Promise<UnusedUploadsResponse> {
  return requestJson<UnusedUploadsResponse>('/uploads/unused');
}

export async function deleteUnusedUploads(
  filenames?: string[]
): Promise<DeleteUnusedUploadsResponse> {
  return requestJson<DeleteUnusedUploadsResponse>('/uploads/unused', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ filenames })
  });
}
