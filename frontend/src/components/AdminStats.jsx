import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { ChartLine, Users, Heart, Bookmark, Folder } from '@phosphor-icons/react';

export default function AdminStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/api/admin/stats');
        setStats(data);
      } catch {}
    };
    fetchStats();
  }, []);

  if (!stats) return <div className="text-xs text-muted-foreground text-center py-6">Loading statistics...</div>;

  const cardItems = [
    { label: 'Total Users', val: stats.counts?.users, icon: <Users size={16} /> },
    { label: 'Showcase Projects', val: stats.counts?.projects, icon: <Folder size={16} /> },
    { label: 'Project Likes', val: stats.counts?.likes, icon: <Heart size={16} /> },
    { label: 'Student Follows', val: stats.counts?.follows, icon: <Bookmark size={16} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center justify-between p-4 rounded-lg border border-border bg-accent/10">
        <div className="flex items-center gap-2">
          <ChartLine size={18} className="text-green-500 animate-pulse" />
          <span className="text-xs font-semibold">System Health: <span className="text-green-500 font-bold uppercase">{stats.systemHealth}</span></span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Uptime: {Math.round(stats.serverUptime / 60)} mins</span>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cardItems.map((item, idx) => (
          <div key={idx} className="p-4 rounded-lg border border-border bg-card flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <h3 className="text-lg font-bold leading-none">{item.val ?? 0}</h3>
            </div>
            <div className="text-primary p-2 bg-primary/10 rounded-md">{item.icon}</div>
          </div>
        ))}
      </div>
    </div>
  );
}