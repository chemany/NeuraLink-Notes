import { NotePadNote } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
console.log('API_BASE_URL:', API_BASE_URL);
/**
 * 获取指定笔记本的所有记事本笔记
 * @param notebookId 笔记本ID
 * @returns Promise<NotePadNote[]> 返回记事本笔记数组
 */
export const getNotePadNotesApi = async (notebookId: string): Promise<NotePadNote[]> => {
  console.log(`[notePadService] Fetching notes for notebook: ${notebookId}`);
  try {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/notebooks/${notebookId}/notes`, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error('[notePadService] Error fetching notes:', errorData);
      throw new Error(`Failed to fetch notes: ${errorData.message || response.statusText}`);
    }

    const notes: NotePadNote[] = await response.json();
    console.log(`[notePadService] Successfully fetched ${notes.length} notes`);
    return notes;

  } catch (error) {
    console.error('[notePadService] Error fetching notes:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('An unexpected error occurred while fetching notes');
    }
  }
};

/**
 * 创建新的记事本笔记
 * @param notebookId 笔记本ID
 * @param note 笔记数据
 * @returns Promise<NotePadNote> 返回创建的笔记
 */
export const createNotePadNoteApi = async (notebookId: string, note: Omit<NotePadNote, 'id' | 'createdAt'>): Promise<NotePadNote> => {
  console.log(`[notePadService] Creating note for notebook: ${notebookId}`);
  try {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/notebooks/${notebookId}/notes`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(note),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error('[notePadService] Error creating note:', errorData);
      throw new Error(`Failed to create note: ${errorData.message || response.statusText}`);
    }

    const newNote: NotePadNote = await response.json();
    console.log('[notePadService] Successfully created note:', newNote);
    return newNote;

  } catch (error) {
    console.error('[notePadService] Error creating note:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('An unexpected error occurred while creating note');
    }
  }
};

/**
 * 更新记事本笔记
 * @param notebookId 笔记本ID
 * @param noteId 笔记ID
 * @param updates 更新的数据
 * @returns Promise<NotePadNote> 返回更新后的笔记
 */
export const updateNotePadNoteApi = async (notebookId: string, noteId: string, updates: Partial<NotePadNote>): Promise<NotePadNote> => {
  console.log(`[notePadService] Updating note ${noteId} in notebook ${notebookId}`);
  try {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/notebooks/${notebookId}/notes/${noteId}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error('[notePadService] Error updating note:', errorData);
      throw new Error(`Failed to update note: ${errorData.message || response.statusText}`);
    }

    const updatedNote: NotePadNote = await response.json();
    console.log('[notePadService] Successfully updated note:', updatedNote);
    return updatedNote;

  } catch (error) {
    console.error('[notePadService] Error updating note:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('An unexpected error occurred while updating note');
    }
  }
};

/**
 * 删除记事本笔记
 * @param notebookId 笔记本ID
 * @param noteId 笔记ID
 * @returns Promise<void>
 */
export const deleteNotePadNoteApi = async (notebookId: string, noteId: string): Promise<void> => {
  console.log(`[notePadService] Deleting note ${noteId} from notebook ${notebookId}`);
  try {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {}; // For DELETE, Content-Type might not be needed
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/notebooks/${notebookId}/notes/${noteId}`, {
      method: 'DELETE',
      headers: headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error('[notePadService] Error deleting note:', errorData);
      throw new Error(`Failed to delete note: ${errorData.message || response.statusText}`);
    }

    console.log('[notePadService] Successfully deleted note');

  } catch (error) {
    console.error('[notePadService] Error deleting note:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('An unexpected error occurred while deleting note');
    }
  }
}; 