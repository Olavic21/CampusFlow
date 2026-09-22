import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Cpu, AlertTriangle, Trash2, Plus, ShieldCheck } from 'lucide-react';
import { SkeletonList } from '../components/ui/Skeleton';
import {
  listUsers,
  updateUser,
  listSensorsAuth,
  createSensor,
  deleteSensor,
  listIncidentsAdmin,
  createIncident,
  closeIncident,
} from '../services/adminApi';

const TABS = [
  { id: 'users', label: 'Utilisateurs', Icon: Users },
  { id: 'sensors', label: 'Capteurs', Icon: Cpu },
  { id: 'incidents', label: 'Incidents', Icon: AlertTriangle },
];

const ROLES = ['student', 'staff', 'admin'];

/* __PART2__ */