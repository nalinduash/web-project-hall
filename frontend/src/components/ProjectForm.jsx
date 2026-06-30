import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import api from '../lib/api';

export default function ProjectForm({ open, onClose, project, onSuccess }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (project) {
      setTitle(project.title);
      setDescription(project.description);
      setVisibility(project.visibility || 'private');
    } else {
      setTitle('');
      setDescription('');
      setVisibility('private');
    }
    setError('');
  }, [project, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (project) {
        const { data } = await api.put(`/api/projects/${project.id}`, { title, description, visibility });
        onSuccess(data);
      } else {
        const { data } = await api.post('/api/projects', { title, description, visibility });
        onSuccess(data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card">
        <DialogHeader>
          <DialogTitle>{project ? 'Edit Project' : 'New Project'}</DialogTitle>
        </DialogHeader>
        {error && <div className="p-2 text-xs rounded border bg-destructive/10 text-destructive border-destructive/20">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. My Portfolio Project" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explain the project goal, stack, and features..." className="min-h-[100px]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="visibility">Visibility</Label>
            <select
              id="visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="private">Private (Only visible to you and Admins)</option>
              <option value="public">Public (Visible to everyone)</option>
            </select>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Project'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
