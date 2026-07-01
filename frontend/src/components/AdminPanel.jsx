import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminStats from './AdminStats';
import AdminUsers from './AdminUsers';
import AdminProjects from './AdminProjects';
import { ChartLine, Users, Folder } from '@phosphor-icons/react';

export default function AdminPanel({ onSelectAuthor }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight">Admin Control Panel</h1>
        <p className="text-xs text-muted-foreground">Manage roles, moderate student submissions, and view system statistics.</p>
      </div>

      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md bg-muted">
          <TabsTrigger value="stats" className="gap-1.5 text-xs">
            <ChartLine size={14} /> Stats
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5 text-xs">
            <Users size={14} /> Users
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5 text-xs">
            <Folder size={14} /> Projects
          </TabsTrigger>
        </TabsList>
        <Card className="mt-4 bg-card border border-border">
          <CardContent className="p-6">
            <TabsContent value="stats" className="mt-0">
              <AdminStats />
            </TabsContent>
            <TabsContent value="users" className="mt-0">
              <AdminUsers />
            </TabsContent>
            <TabsContent value="projects" className="mt-0">
              <AdminProjects onSelectAuthor={onSelectAuthor} />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
