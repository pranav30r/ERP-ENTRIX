import { Request, Response } from 'express';
import { Department, User } from '../models';

export interface ProjectData {
  id: string;
  name: string;
  code: string;
  department_code: string;
  allocated_budget: number;
  consumed_budget: number;
  milestones_total: number;
  milestones_completed: number;
  logged_hours: number;
  estimated_hours: number;
  status: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
}

// In-memory demo projects (persisted in DB or demo state)
let projects: ProjectData[] = [
  {
    id: 'prj-001',
    name: 'Project Apollo — Core ERP Architecture',
    code: 'PRJ-APOLLO',
    department_code: 'DEPT-ENG',
    allocated_budget: 150000,
    consumed_budget: 85000,
    milestones_total: 10,
    milestones_completed: 6,
    logged_hours: 120,
    estimated_hours: 180,
    status: 'IN_PROGRESS'
  },
  {
    id: 'prj-002',
    name: 'Warehouse Automation & RFID Tagging',
    code: 'PRJ-RFID',
    department_code: 'DEPT-PROC',
    allocated_budget: 80000,
    consumed_budget: 32000,
    milestones_total: 6,
    milestones_completed: 4,
    logged_hours: 65,
    estimated_hours: 90,
    status: 'IN_PROGRESS'
  }
];

export const getProjects = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: projects });
};

export const createProject = async (req: Request, res: Response): Promise<void> => {
  const { name, code, department_code, allocated_budget, estimated_hours, milestones_total } = req.body;

  if (!name || !code || !allocated_budget) {
    res.status(400).json({ success: false, error: 'Name, code, and allocated budget are required.' });
    return;
  }

  const newProject: ProjectData = {
    id: `prj-${Date.now()}`,
    name,
    code,
    department_code: department_code || 'DEPT-ENG',
    allocated_budget: Number(allocated_budget),
    consumed_budget: 0,
    milestones_total: Number(milestones_total) || 5,
    milestones_completed: 0,
    logged_hours: 0,
    estimated_hours: Number(estimated_hours) || 100,
    status: 'PLANNING'
  };

  projects.push(newProject);
  res.status(201).json({ success: true, data: newProject });
};
