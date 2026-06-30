import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import api from '../lib/api';

export default function ThumbnailUpload({ open, projectId, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    setError('');
    if (!selected) return;

    // Validate type
    if (!/image\/(jpeg|png|webp|gif)/.test(selected.type)) {
      setError('Only JPEG, PNG, WEBP, and GIF images are allowed.');
      setFile(null);
      return;
    }

    // Validate size (5MB limit)
    if (selected.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB.');
      setFile(null);
      return;
    }

    setFile(selected);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return setError('Please select a file first.');
    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('thumbnail', file);

    try {
      await api.post(`/api/projects/${projectId}/thumbnail`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload thumbnail.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] bg-card">
        <DialogHeader>
          <DialogTitle>Upload Project Thumbnail</DialogTitle>
        </DialogHeader>
        {error && <div className="p-2 text-xs rounded border bg-destructive/10 text-destructive border-destructive/20">{error}</div>}
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="thumbnail">Image File</Label>
            <Input id="thumbnail" type="file" accept="image/*" onChange={handleFileChange} />
            <p className="text-[10px] text-muted-foreground">JPEG, PNG, WEBP, GIF (Max 5MB)</p>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Skip</Button>
            <Button type="submit" disabled={!file || loading}>{loading ? 'Uploading...' : 'Upload'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
