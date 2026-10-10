export interface AttendanceDay {
  date: string;
  status: "Present" | "Late" | "Absent";
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  employeeId: string;
  email: string;
  phone: string;
  dateJoined: string;
  employmentType: string;
  supervisor: string;
  lastActivity: string;
  lastLogin: string;
  patientsAttended: number;
  currentStatus: string;
  totalTasks: number;
  averageTime: string;
  completionRate: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  presentPercent: number;
  punctualityPercent: number;
  attendanceHistory: AttendanceDay[];
}

export const STAFF: StaffMember[] = [
  {
    id: "1",
    name: "Angela Basnet",
    role: "Registered Nurse",
    employeeId: "AA00DD12345",
    email: "angela.basnet@caresync.io",
    phone: "+44 7700 900123",
    dateJoined: "29th April 2021",
    employmentType: "Intern / Full-Time Employee",
    supervisor: "Dr. Camroon King",
    lastActivity: "Eleanor's Blood Pressure Check",
    lastLogin: "23rd July | 10:50 AM",
    patientsAttended: 32,
    currentStatus: "Working on Eleanor's Morning Meds",
    totalTasks: 23,
    averageTime: "8 hr",
    completionRate: "91%",
    presentDays: 497,
    absentDays: 17,
    lateDays: 32,
    presentPercent: 77,
    punctualityPercent: 71,
    attendanceHistory: [
      { date: "21 Jul 2025", status: "Present" },
      { date: "20 Jul 2025", status: "Present" },
      { date: "19 Jul 2025", status: "Late" },
      { date: "18 Jul 2025", status: "Present" },
      { date: "17 Jul 2025", status: "Absent" },
      { date: "16 Jul 2025", status: "Present" },
      { date: "15 Jul 2025", status: "Present" },
      { date: "14 Jul 2025", status: "Late" },
      { date: "13 Jul 2025", status: "Present" },
      { date: "12 Jul 2025", status: "Present" },
    ],
  },
  {
    id: "2",
    name: "Angela Pillar",
    role: "Registered Nurse",
    employeeId: "AP00RN98765",
    email: "angela.pillar@caresync.io",
    phone: "+44 7700 900456",
    dateJoined: "15th March 2020",
    employmentType: "Full-Time Employee",
    supervisor: "Dr. Camroon King",
    lastActivity: "Medication Administration — Margaret Lee",
    lastLogin: "23rd July | 9:15 AM",
    patientsAttended: 58,
    currentStatus: "On Shift",
    totalTasks: 31,
    averageTime: "6 hr",
    completionRate: "96%",
    presentDays: 612,
    absentDays: 8,
    lateDays: 14,
    presentPercent: 94,
    punctualityPercent: 89,
    attendanceHistory: [
      { date: "21 Jul 2025", status: "Present" },
      { date: "20 Jul 2025", status: "Present" },
      { date: "19 Jul 2025", status: "Present" },
      { date: "18 Jul 2025", status: "Present" },
      { date: "17 Jul 2025", status: "Late" },
      { date: "16 Jul 2025", status: "Present" },
      { date: "15 Jul 2025", status: "Present" },
      { date: "14 Jul 2025", status: "Present" },
      { date: "13 Jul 2025", status: "Absent" },
      { date: "12 Jul 2025", status: "Present" },
    ],
  },
  {
    id: "3",
    name: "Peter Okonkwo",
    role: "Home Care Assistant",
    employeeId: "CS-1042",
    email: "peter.okonkwo@caresync.io",
    phone: "+44 7700 900789",
    dateJoined: "5th January 2023",
    employmentType: "Full-Time Employee",
    supervisor: "Dr. Camroon King",
    lastActivity: "Eleanor's Morning Visit",
    lastLogin: "23rd July | 7:00 AM",
    patientsAttended: 14,
    currentStatus: "Checked In — Eleanor's Visit",
    totalTasks: 12,
    averageTime: "2 hr",
    completionRate: "88%",
    presentDays: 310,
    absentDays: 5,
    lateDays: 10,
    presentPercent: 95,
    punctualityPercent: 91,
    attendanceHistory: [
      { date: "21 Jul 2025", status: "Present" },
      { date: "20 Jul 2025", status: "Present" },
      { date: "19 Jul 2025", status: "Present" },
      { date: "18 Jul 2025", status: "Late" },
      { date: "17 Jul 2025", status: "Present" },
      { date: "16 Jul 2025", status: "Present" },
      { date: "15 Jul 2025", status: "Absent" },
      { date: "14 Jul 2025", status: "Present" },
      { date: "13 Jul 2025", status: "Present" },
      { date: "12 Jul 2025", status: "Present" },
    ],
  },
  {
    id: "4",
    name: "Sarah Ndegwa",
    role: "Senior Care Assistant",
    employeeId: "SN00CA55555",
    email: "sarah.ndegwa@caresync.io",
    phone: "+44 7700 900321",
    dateJoined: "10th September 2021",
    employmentType: "Part-Time Employee",
    supervisor: "Dr. Camroon King",
    lastActivity: "Wound Dressing — Tom Harris",
    lastLogin: "22nd July | 4:30 PM",
    patientsAttended: 41,
    currentStatus: "Off Shift",
    totalTasks: 27,
    averageTime: "5 hr",
    completionRate: "93%",
    presentDays: 402,
    absentDays: 12,
    lateDays: 20,
    presentPercent: 88,
    punctualityPercent: 82,
    attendanceHistory: [
      { date: "21 Jul 2025", status: "Absent" },
      { date: "20 Jul 2025", status: "Present" },
      { date: "19 Jul 2025", status: "Present" },
      { date: "18 Jul 2025", status: "Late" },
      { date: "17 Jul 2025", status: "Present" },
      { date: "16 Jul 2025", status: "Present" },
      { date: "15 Jul 2025", status: "Late" },
      { date: "14 Jul 2025", status: "Present" },
      { date: "13 Jul 2025", status: "Present" },
      { date: "12 Jul 2025", status: "Absent" },
    ],
  },
];
