import { supabase, isSupabaseConfigured } from './supabase';

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Uploads a file to Supabase Storage with exponential backoff retries.
 * @param file The file to upload
 * @param userId The user ID for the storage path
 * @param folder The folder within the user's directory (e.g., 'attachments', 'completed')
 * @param retries Number of retry attempts
 * @returns The public URL of the uploaded file
 */
export const uploadFileWithRetry = async (file: File, userId: string, folder: string = 'attachments', retries: number = 3): Promise<string> => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Secrets.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();

  console.log('Storage Upload Initialization:', {
    targetUserId: userId,
    sessionUserId: session?.user?.id,
    authenticatedUser: user?.id,
    isAuthenticated: !!session,
    bucket: 'PROJECT-ATTACHMENTS'
  });

  if (!session || !user) {
    console.warn('No active session found during upload attempt. RLS policies will likely fail.');
    throw new Error('You must be logged in to upload files. Please sign in and try again.');
  }

  // Check if bucket exists (optional, but helpful for debugging)
  // Note: getBucket may fail with 400/403 if the anon key doesn't have management permissions
  // We'll just log the error but not throw, and let the actual upload attempt handle failures.
  try {
    const { data: bucketData, error: bucketError } = await supabase.storage.getBucket('PROJECT-ATTACHMENTS');
    if (bucketError) {
      console.warn('Bucket check failed (this is often expected if using anon key):', {
        error: bucketError,
        bucket: 'PROJECT-ATTACHMENTS',
        suggestion: 'Ensure the bucket exists in Supabase Storage and is named exactly "PROJECT-ATTACHMENTS" (case-sensitive). You must create it manually in the Supabase dashboard if it does not exist.'
      });
    } else {
      console.log('Bucket verified:', {
        id: bucketData.id,
        name: bucketData.name,
        public: bucketData.public
      });
    }
  } catch (e) {
    console.warn('Unexpected error during bucket check:', e);
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${folder}/${fileName}`;

  let attempt = 0;
  while (attempt < retries) {
    try {
      // Refresh session before each attempt
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        throw new Error('Session expired. Please sign in again.');
      }

      console.log(`Upload attempt ${attempt + 1}/${retries} for ${file.name}`, {
        bucket: 'PROJECT-ATTACHMENTS',
        path: filePath,
        userId: userId,
        sessionUserId: currentSession.user.id
      });

      const { error: uploadError, data } = await supabase.storage
        .from('PROJECT-ATTACHMENTS')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        const isPermissionError = uploadError.message.toLowerCase().includes('permission') || uploadError.message.toLowerCase().includes('insufficient');
        const isBucketError = uploadError.message.toLowerCase().includes('bucket') || uploadError.message.toLowerCase().includes('not found');
        
        let customMessage = uploadError.message;
        if (isPermissionError) {
          customMessage = 'Permission denied. Please ensure RLS policies are configured in Supabase for the "PROJECT-ATTACHMENTS" bucket.';
        } else if (isBucketError) {
          customMessage = 'Bucket "PROJECT-ATTACHMENTS" not found. Please create it in your Supabase Storage dashboard.';
        }

        console.error('Supabase Storage Error Details:', {
          error: uploadError,
          bucket: 'PROJECT-ATTACHMENTS',
          path: filePath,
          userId: userId,
          authenticatedUserId: user?.id,
          fileName: file.name,
          suggestedFix: isPermissionError ? 'Check RLS Policies and ensure user is logged in' : isBucketError ? 'Create Bucket' : 'Check Supabase Config'
        });
        throw new Error(customMessage);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('PROJECT-ATTACHMENTS')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err: any) {
      attempt++;
      const errorMessage = err.message || 'Unknown storage error';
      console.error(`Upload attempt ${attempt} failed for ${file.name}:`, errorMessage);
      
      if (attempt >= retries) {
        throw new Error(`${errorMessage}. Please ensure the "PROJECT-ATTACHMENTS" bucket exists and has correct RLS policies.`);
      }
      
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Failed to upload ${file.name} after ${retries} attempts.`);
};
