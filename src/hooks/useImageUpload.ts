import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useImageUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadImage = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    
    try {
      // Generate filename: original_name-ddmmaaaahhmmss.ext
      const lastDot = file.name.lastIndexOf('.');
      const rawName = lastDot > 0 ? file.name.substring(0, lastDot) : file.name;
      const fileExt = lastDot > 0 ? file.name.substring(lastDot + 1) : '';
      const sanitizedName = rawName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestamp = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const fileName = `${sanitizedName}-${timestamp}${fileExt ? '.' + fileExt : ''}`;
      
      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from('imagens-cardapio')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        toast({
          title: "Erro no upload",
          description: `Não foi possível fazer o upload da imagem: ${error.message}`,
          variant: "destructive",
        });
        return null;
      }

      // Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('imagens-cardapio')
        .getPublicUrl(data.path);

      toast({
        title: "Sucesso",
        description: "Imagem enviada com sucesso!",
      });

      return urlData.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado durante o upload",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadImage, isUploading };
};
