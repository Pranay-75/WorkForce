'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMockStore } from '@/lib/mockStore';
import { Employee, SkillLevel } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Dialog } from '@/components/ui/Dialog';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  ArrowRight,
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function EmployeesDirectoryPage() {
  const { employees, skills, addNewEmployee } = useMockStore();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedDept, setSelectedDept] = React.useState<string>('all');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');
  const [selectedSkill, setSelectedSkill] = React.useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);

  // New Employee Form State
  const [newName, setNewName] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [newTitle, setNewTitle] = React.useState('');
  const [newDept, setNewDept] = React.useState<Employee['department']>('Engineering');
  const [newCapacity, setNewCapacity] = React.useState('40');
  const [newLocation, setNewLocation] = React.useState('San Francisco, CA');

  // Filter logic
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept = selectedDept === 'all' || emp.department === selectedDept;

    const utilRate = emp.currentLoadHours / emp.weeklyCapacityHours;
    let matchesStatus = true;
    if (selectedStatus === 'available') matchesStatus = utilRate < 0.6;
    else if (selectedStatus === 'optimal') matchesStatus = utilRate >= 0.6 && utilRate <= 0.9;
    else if (selectedStatus === 'overloaded') matchesStatus = utilRate > 0.9;

    const matchesSkill =
      selectedSkill === 'all' ||
      emp.skills.some((s) => s.skillName.toLowerCase() === selectedSkill.toLowerCase());

    return matchesSearch && matchesDept && matchesStatus && matchesSkill;
  });

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newTitle.trim()) return;

    addNewEmployee({
      fullName: newName,
      email: newEmail,
      jobTitle: newTitle,
      department: newDept,
      weeklyCapacityHours: parseFloat(newCapacity) || 40,
      role: 'employee',
      location: newLocation,
      skills: [
        { skillId: 's1', skillName: 'React', category: 'Frontend', proficiency: 'intermediate', verified: true },
        { skillId: 's2', skillName: 'TypeScript', category: 'Frontend', proficiency: 'intermediate', verified: true },
      ],
    });

    setIsAddModalOpen(false);
    setNewName('');
    setNewEmail('');
    setNewTitle('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Talent Directory & Capacity Roster
            </h2>
            <Badge variant="cyan" size="sm">
              {filteredEmployees.length} Members
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Browse verified skills, monitor live capacity utilization, and inspect individual workloads
          </p>
        </div>

        <Button variant="primary" size="md" onClick={() => setIsAddModalOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1.5" />
          <span>Add Employee</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-slate-800 bg-navy-900/80 p-4 backdrop-blur-sm">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, role, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-700/80 bg-navy-850 px-3 py-1.5 pl-9 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
        </div>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="rounded-lg border border-slate-700/80 bg-navy-850 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
        >
          <option value="all">All Departments</option>
          <option value="Engineering">Engineering</option>
          <option value="Design">Design</option>
          <option value="DevOps">DevOps</option>
          <option value="QA">QA</option>
          <option value="Product">Product</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="rounded-lg border border-slate-700/80 bg-navy-850 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
        >
          <option value="all">All Capacity Bands</option>
          <option value="available">Available (&lt; 60% load)</option>
          <option value="optimal">Optimal (60% - 90% load)</option>
          <option value="overloaded">At/Over Capacity (&gt; 90% load)</option>
        </select>

        <select
          value={selectedSkill}
          onChange={(e) => setSelectedSkill(e.target.value)}
          className="rounded-lg border border-slate-700/80 bg-navy-850 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
        >
          <option value="all">Filter by Key Skill (All)</option>
          {skills.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name} ({s.category})
            </option>
          ))}
        </select>
      </div>

      {/* Employee Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredEmployees.map((emp) => {
          const utilPct = Math.round(
            (emp.currentLoadHours / emp.weeklyCapacityHours) * 100
          );
          const initials = emp.fullName
            .split(' ')
            .map((n) => n[0])
            .join('');

          return (
            <Card
              key={emp.id}
              className="flex flex-col justify-between border-slate-800/90 hover:border-violet-500/50 hover:shadow-glow/20 transition-all duration-200 group"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-purple-700 to-indigo-800 text-sm font-bold text-white shadow-sm border border-violet-400/30">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors truncate">
                        {emp.fullName}
                      </h3>
                      <p className="text-xs text-slate-400 truncate">
                        {emp.jobTitle}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      utilPct > 100
                        ? 'rose'
                        : utilPct >= 80
                        ? 'amber'
                        : 'emerald'
                    }
                    size="sm"
                  >
                    {utilPct > 100
                      ? 'Overloaded'
                      : utilPct >= 80
                      ? 'Near Limit'
                      : 'Optimal'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 flex-1">
                {/* Department & Location */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/60 pb-2.5">
                  <span className="font-semibold text-slate-300">
                    {emp.department}
                  </span>
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 text-slate-500" />
                    {emp.location}
                  </span>
                </div>

                {/* Capacity Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Weekly Load</span>
                    <span
                      className={
                        utilPct > 100
                          ? 'text-rose-400 font-bold'
                          : 'text-slate-200'
                      }
                    >
                      {emp.currentLoadHours}h / {emp.weeklyCapacityHours}h ({utilPct}%)
                    </span>
                  </div>
                  <ProgressBar value={utilPct} />
                </div>

                {/* Skills Tags */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Verified Skills
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {emp.skills.slice(0, 3).map((s) => (
                      <Badge key={s.skillId} variant="cyan" size="sm">
                        {s.skillName}
                        <span className="text-[9px] text-cyan-300 font-mono">
                          • {s.proficiency[0].toUpperCase()}
                        </span>
                      </Badge>
                    ))}
                    {emp.skills.length > 3 && (
                      <Badge variant="slate" size="sm">
                        +{emp.skills.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>

              <div className="border-t border-slate-800/80 bg-navy-950/40 p-3 px-5 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">
                  {emp.activeTaskCount} active task{emp.activeTaskCount !== 1 ? 's' : ''}
                </span>
                <Link href={`/employees/${emp.id}`}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    <span>View Profile</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-slate-500 mb-3" />
          <h4 className="text-base font-bold text-white">No talent matching filters</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Try adjusting your search criteria or clear your active filters.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedDept('all');
              setSelectedStatus('all');
              setSelectedSkill('all');
            }}
          >
            Clear All Filters
          </Button>
        </div>
      )}

      {/* Add Employee Dialog Modal */}
      <Dialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Team Member"
        description="Simulated profile creation for synthetic demonstration."
      >
        <form onSubmit={handleCreateEmployee} className="space-y-3.5 py-2">
          <Input
            label="Full Name *"
            placeholder="e.g. Jordan Miller"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <Input
            label="Work Email *"
            type="email"
            placeholder="e.g. jordan.miller@acme.corp"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />
          <Input
            label="Job Title *"
            placeholder="e.g. Senior Frontend Architect"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Department"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value as Employee['department'])}
              options={[
                { label: 'Engineering', value: 'Engineering' },
                { label: 'Design', value: 'Design' },
                { label: 'DevOps', value: 'DevOps' },
                { label: 'QA', value: 'QA' },
                { label: 'Product', value: 'Product' },
              ]}
            />
            <Input
              label="Weekly Capacity (Hours)"
              type="number"
              value={newCapacity}
              onChange={(e) => setNewCapacity(e.target.value)}
              min="10"
              max="60"
            />
          </div>
          <Input
            label="Location / Timezone"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
          />

          <div className="pt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Create Profile
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
