import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, MagnifyingGlass } from '@phosphor-icons/react';
import ProjectCard from './ProjectCard';
import ProjectForm from './ProjectForm';
import ThumbnailUpload from './ThumbnailUpload';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function ProjectsFeed({ onSelectAuthor }) {
  const { userProfile } = useAuth();
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [activeProject, setActiveProject] = useState(null);
  const [uploadProject, setUploadProject] = useState(null);

  const fetchProjects = async () => {
    try {
      const { data } = await api.get('/api/projects');
      setProjects(data);
    } catch {}
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this project?')) return;
    try {
      await api.delete(`/api/projects/${id}`);
      fetchProjects();
    } catch {}
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const canCreate = userProfile?.permissions?.includes('projects:create') || userProfile?.role === 'student';

  const filtered = projects.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase()) ||
    p.author_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canCreate && (
          <Button onClick={() => { setActiveProject(null); setFormOpen(true); }} className="gap-1.5 text-xs font-semibold self-start sm:self-auto">
            <Plus size={14} /> New Project
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-xs text-muted-foreground border border-dashed border-border rounded-xl">No projects found.</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              isOwner={userProfile?.id === p.author_id}
              onSelectAuthor={onSelectAuthor}
              onEdit={(proj) => { setActiveProject(proj); setFormOpen(true); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <ProjectForm
          open={formOpen}
          project={activeProject}
          onClose={() => setFormOpen(false)}
          onSuccess={(savedProj) => {
            setFormOpen(false);
            if (!activeProject) {
              setUploadProject(savedProj); // Open thumbnail upload for new projects
            } else {
              fetchProjects();
            }
          }}
        />
      )}

      {uploadProject && (
        <ThumbnailUpload
          open={!!uploadProject}
          projectId={uploadProject.id}
          onClose={() => { setUploadProject(null); fetchProjects(); }}
          onSuccess={() => { setUploadProject(null); fetchProjects(); }}
        />
      )}
    </div>
  );
}
