"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { Project } from "./db/schema";
import { generateInvoicePDF } from './components/InvoicePDF';
import useSWR from 'swr';

type TimeEntry = {
  id: string;
  date: string;
  timeIn: string;
  timeOut: string;
  hours: number | string;
  projectId: string | null;
  projectName?: string;
  projectLink?: string;
  clockInTimestamp: number;
  isActive: boolean;
};

type Shift = {
  shiftId: string;
  clockIn: string;
  clockOut: string | null;
  duration: number | null;
  projectId: string | null;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  startDate: string;
  endDate: string;
  total: string;
  status: string;
};

type WeeklyInvoiceCard = {
  startDate: Date;
  endDate: Date;
  totalHours: number;
  projectCount: number;
  totalAmount: number;
  projects: {
    name: string;
    hours: number;
    amount: number;
  }[];
};

type InvoicePeriod = 'weekly' | 'biweekly' | 'monthly';

// Create a fetcher function for SWR
const fetcher = (url: string) => fetch(url).then(res => res.json());

// SWR configuration for better performance
const swrConfig = {
  revalidateOnFocus: false, // Don't revalidate when window regains focus
  dedupingInterval: 5000,   // Dedupe similar requests within 5 seconds
};

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [time, setTime] = useState(new Date());
  const [clockedIn, setClockedIn] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayStats, setTodayStats] = useState({ hoursToday: 0, weekTotal: 0 });
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', link: '' });
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState<{ startDate: string; endDate: string }>({
    startDate: '',
    endDate: '',
  });
  const [weeklyCards, setWeeklyCards] = useState<WeeklyInvoiceCard[]>([]);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<{
    id: string;
    clockInDate: string;
    clockInTime: string;
    clockOutDate: string;
    clockOutTime: string;
  } | null>(null);
  const [invoicePeriod, setInvoicePeriod] = useState<InvoicePeriod>('biweekly');

  // SWR hooks for data fetching with caching and revalidation
  const { data: clockStatusData, mutate: mutateClockStatus } = useSWR(
    session?.user?.id ? `/api/timecard?userId=${session.user.id}&action=status` : null,
    fetcher,
    swrConfig
  );
  
  const { data: shiftsData, mutate: mutateShifts } = useSWR(
    session?.user?.id ? `/api/timecard?userId=${session.user.id}&action=shifts` : null,
    fetcher,
    swrConfig
  );
  
  const { data: projectsData, mutate: mutateProjects } = useSWR(
    session?.user?.id ? `/api/projects?userId=${session.user.id}` : null,
    fetcher,
    swrConfig
  );
  
  const { data: invoicesData, mutate: mutateInvoices } = useSWR('/api/invoices', fetcher, swrConfig);
  
  const { data: userConfigData, mutate: mutateUserConfig } = useSWR('/api/user-config', fetcher, {
    ...swrConfig,
    revalidateOnFocus: false,
    revalidateIfStale: false,  // Only fetch once since config rarely changes
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    }
  }, [status, router]);

  // Process clock status data
  useEffect(() => {
    if (clockStatusData) {
      if (clockStatusData.isClocked && clockStatusData.lastClockIn) {
        setClockedIn(true);
        setCurrentShiftId(clockStatusData.lastClockIn.shiftId);
        setClockInTime(new Date(clockStatusData.lastClockIn.timestamp));
      } else {
        // Explicitly handle clocked out state
        setClockedIn(false);
        setCurrentShiftId(null);
        setClockInTime(null);
        setTimeElapsed(0);
      }
      setLoading(false);
    }
  }, [clockStatusData]);

  // Process shifts data
  useEffect(() => {
    if (shiftsData?.shifts && projectsData?.projects) {
      // Transform shifts data for display
      const formattedEntries = shiftsData.shifts.map((shift: Shift) => {
        const project = projectsData.projects.find((p: Project) => p.id === shift.projectId);
        return {
          id: shift.shiftId,
          date: new Date(shift.clockIn).toLocaleDateString(),
          timeIn: new Date(shift.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timeOut: shift.clockOut ? new Date(shift.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
          hours: formatDuration(shift.duration),
          projectId: shift.projectId,
          projectName: project?.name,
          projectLink: project?.link,
          clockInTimestamp: new Date(shift.clockIn).getTime(),
          isActive: !shift.clockOut && shift.shiftId === currentShiftId
        };
      });

      // Sort entries: active clock-ins first, then by date (newest to oldest)
      const sortedEntries = formattedEntries.sort((a: TimeEntry, b: TimeEntry) => {
        // Active clock-ins always come first
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        // Then sort by timestamp (newest first)
        return b.clockInTimestamp - a.clockInTimestamp;
      });

      setEntries(sortedEntries);
      calculateTodayStats(shiftsData.shifts);
      setLoading(false);
    }
  }, [shiftsData, projectsData, currentShiftId]);

  // Process projects data
  useEffect(() => {
    if (projectsData?.projects) {
      setProjects(projectsData.projects);
    }
  }, [projectsData]);

  // Process invoices data
  useEffect(() => {
    if (invoicesData?.invoices) {
      setInvoices(invoicesData.invoices || []);
    }
  }, [invoicesData]);

  // Process user config data
  useEffect(() => {
    if (userConfigData?.invoiceSettings) {
      setInvoiceSettings(userConfigData.invoiceSettings || { defaultHourlyRate: "0" });
    }
  }, [userConfigData]);

  // Update clock and elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      if (clockedIn && clockInTime) {
        const elapsed = Math.floor((new Date().getTime() - clockInTime.getTime()) / 1000);
        setTimeElapsed(elapsed);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [clockedIn, clockInTime]);

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const calculateTodayStats = (shifts: Shift[]) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    let todaySeconds = 0;
    let weekSeconds = 0;

    shifts.forEach(shift => {
      const shiftStart = new Date(shift.clockIn);
      const shiftEnd = shift.clockOut ? new Date(shift.clockOut) : clockedIn && shift.shiftId === currentShiftId ? now : null;

      if (!shiftEnd) return;

      const duration = (shiftEnd.getTime() - shiftStart.getTime()) / 1000;

      // Check if shift is from today
      if (shiftStart >= startOfToday) {
        todaySeconds += duration;
      }

      // Check if shift is from this week
      if (shiftStart >= startOfWeek) {
        weekSeconds += duration;
      }
    });

    // Add current session time if clocked in
    if (clockedIn && clockInTime) {
      const currentDuration = (now.getTime() - clockInTime.getTime()) / 1000;
      todaySeconds += currentDuration;
      weekSeconds += currentDuration;
    }

    setTodayStats({
      hoursToday: Math.round((todaySeconds / 3600) * 10) / 10,
      weekTotal: Math.round((weekSeconds / 3600) * 10) / 10,
    });
  };

  const createProject = async () => {
    if (!session?.user?.id) return;

    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProject,
          userId: session.user.id,
        }),
      });
      setNewProject({ name: '', link: '' });
      setShowProjectModal(false);
      // Update SWR cache
      mutateProjects();
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const assignProject = async (shiftId: string, projectId: string) => {
    try {
      await fetch('/api/timecard/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId, projectId }),
      });
      setEditingShiftId(null);
      // Update SWR cache
      mutateShifts();
    } catch (error) {
      console.error('Error assigning project:', error);
    }
  };

  const toggleClock = async () => {
    if (!session?.user?.id) return;

    try {
      if (clockedIn) {
        // Clock out
        await fetch('/api/timecard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'clockOut',
            userId: session.user.id,
            shiftId: currentShiftId,
            timestamp: new Date().toISOString(),
          }),
        });

        setClockedIn(false);
        setTimeElapsed(0);
        setCurrentShiftId(null);
        setClockInTime(null);
      } else {
        // Clock in
        const response = await fetch('/api/timecard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'clockIn',
            userId: session.user.id,
            timestamp: new Date().toISOString(),
          }),
        });

        const data = await response.json();
        setClockedIn(true);
        setCurrentShiftId(data.shiftId);
        setClockInTime(new Date());
      }

      // Update SWR caches
      mutateClockStatus();
      mutateShifts();
    } catch (error) {
      console.error('Error toggling clock:', error);
    }
  };

  const generateInvoice = async (startDateStr?: string, endDateStr?: string) => {
    try {
      // Get date strings either from parameters or from state
      const startString = startDateStr || selectedDateRange.startDate;
      const endString = endDateStr || selectedDateRange.endDate;
      
      // Validate that we have both dates before proceeding
      if (!startString || !endString) {
        console.error('Invalid date range:', { startString, endString });
        return;
      }

      // Create proper Date objects and ensure valid dates
      const start = new Date(startString);
      const end = new Date(endString);

      // Validate the dates are valid
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.error('Invalid date objects:', { start, end });
        return;
      }

      // Set end date to end of day to include all entries
      end.setHours(23, 59, 59, 999);

      console.log('Generating invoice with dates:', { start, end, period: invoicePeriod });

      // Generate the invoice
      const invoiceResponse = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          period: invoicePeriod,
          dateGenerated: new Date().toISOString()
        }),
      });

      if (!invoiceResponse.ok) {
        const error = await invoiceResponse.json();
        throw new Error(error.error || 'Failed to generate invoice');
      }

      const invoiceData = await invoiceResponse.json();
      
      if (invoiceData.invoice) {
        // Get user config immediately after invoice generation
        const userConfigResponse = await fetch('/api/user-config');
        const configData = await userConfigResponse.json();
        
        // Set company details
        let companyName = '';
        let companyEmail = '';
        let companyAddress = '';
        let companyPhone = '';
        let paymentTerms = '';
        let notes = '';
        let currency = 'USD';
        
        // Get business info from user config
        if (configData.userConfig) {
          companyName = configData.userConfig.businessName || '';
          companyEmail = configData.userConfig.email || '';
          companyAddress = [
            configData.userConfig.address,
            configData.userConfig.city && configData.userConfig.state ? 
              `${configData.userConfig.city}, ${configData.userConfig.state} ${configData.userConfig.zipCode || ''}` : 
              ''
          ].filter(Boolean).join('\n');
          companyPhone = configData.userConfig.phone || '';
        }
        
        // Get invoice settings
        if (configData.invoiceSettings) {
          paymentTerms = configData.invoiceSettings.paymentTerms || '';
          notes = configData.invoiceSettings.defaultNotes || '';
          currency = configData.invoiceSettings.currency || 'USD';
        }

        // Add period type to invoice metadata
        const invoiceMetadata = {
          ...invoiceData.invoice,
          periodType: invoicePeriod,
          periodLabel: getPeriodLabel(start, invoicePeriod)
        };
        
        // Generate and download PDF immediately
        const doc = generateInvoicePDF({
          invoice: invoiceMetadata,
          companyName,
          companyEmail,
          companyAddress,
          companyPhone,
          paymentTerms,
          notes,
          currency
        });

        // Download PDF
        doc.save(`invoice-${invoiceData.invoice.invoiceNumber}-${invoicePeriod}.pdf`);
        
        // Update SWR cache
        mutateInvoices();
        setShowInvoiceModal(false);
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
    }
  };

  // Helper function to get period label
  const getPeriodLabel = (startDate: Date, period: InvoicePeriod): string => {
    switch (period) {
      case 'weekly':
        return `Week of ${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      case 'biweekly':
        return `Biweekly Period: ${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${
          new Date(startDate.getTime() + 13 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      case 'monthly':
        return `${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
      default:
        return '';
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(amount));
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate weekly cards when entries or invoiceSettings change
  useEffect(() => {
    if (entries.length && invoiceSettings) {
      generateWeeklyCards();
    }
  }, [entries, clockInTime, invoiceSettings, invoicePeriod]);

  const generateWeeklyCards = () => {
    if (!entries.length) return;

    const periodShifts = new Map<string, WeeklyInvoiceCard>();
    const hourlyRate = invoiceSettings?.defaultHourlyRate 
      ? Number(invoiceSettings.defaultHourlyRate) 
      : 0;

    const getPeriodKey = (date: Date) => {
      const periodStart = new Date(date);
      periodStart.setHours(0, 0, 0, 0);
      
      switch (invoicePeriod) {
        case 'weekly': {
          // Start from Sunday of the current week
          const day = periodStart.getDay();
          periodStart.setDate(periodStart.getDate() - day);
          break;
        }
        case 'biweekly': {
          // Get the first day of the month
          const firstDay = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
          // Find first Sunday
          const firstSunday = new Date(firstDay);
          firstSunday.setDate(firstDay.getDate() + (7 - firstDay.getDay()) % 7);
          
          // If date is before first Sunday, use last month's third Sunday
          if (date < firstSunday) {
            const lastMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
            const firstSundayLastMonth = new Date(lastMonth);
            firstSundayLastMonth.setDate(lastMonth.getDate() + (7 - lastMonth.getDay()) % 7);
            periodStart.setTime(firstSundayLastMonth.getTime());
            periodStart.setDate(firstSundayLastMonth.getDate() + 14); // Third Sunday
          } else {
            // If date is between 1st and 2nd Sunday, use first Sunday
            // If date is between 3rd and 4th Sunday, use third Sunday
            const daysSinceFirstSunday = Math.floor((date.getTime() - firstSunday.getTime()) / (24 * 60 * 60 * 1000));
            if (daysSinceFirstSunday < 14) {
              periodStart.setTime(firstSunday.getTime());
            } else {
              periodStart.setTime(firstSunday.getTime());
              periodStart.setDate(firstSunday.getDate() + 14);
            }
          }
          break;
        }
        case 'monthly': {
          // Start from first day of current month
          periodStart.setDate(1);
          break;
        }
      }
      
      return periodStart.toISOString();
    };

    const getPeriodEnd = (startDate: Date) => {
      const endDate = new Date(startDate);
      
      switch (invoicePeriod) {
        case 'weekly': {
          // End on Saturday
          endDate.setDate(startDate.getDate() + 6);
          break;
        }
        case 'biweekly': {
          // End after 13 days (covering full 2 weeks)
          endDate.setDate(startDate.getDate() + 13);
          break;
        }
        case 'monthly': {
          // End on last day of month
          endDate.setMonth(endDate.getMonth() + 1);
          endDate.setDate(0);
          break;
        }
      }
      
      endDate.setHours(23, 59, 59, 999);
      return endDate;
    };

    // Process each entry and group by period
    entries.forEach(entry => {
      const entryDate = new Date(entry.date);
      const periodKey = getPeriodKey(entryDate);
      const periodStart = new Date(periodKey);
      const periodEnd = getPeriodEnd(periodStart);

      // Skip entries that don't belong in the period
      if (entryDate < periodStart || entryDate > periodEnd) {
        return;
      }

      if (!periodShifts.has(periodKey)) {
        periodShifts.set(periodKey, {
          startDate: periodStart,
          endDate: periodEnd,
          totalHours: 0,
          projectCount: 0,
          totalAmount: 0,
          projects: [],
        });
      }

      const card = periodShifts.get(periodKey)!;
      
      let hours = 0;
      if (typeof entry.hours === 'string' && entry.hours !== '-') {
        const match = entry.hours.match(/(\d+)h\s*(\d+)?m?/);
        if (match) {
          const [_, h, m] = match;
          hours = parseInt(h) + (parseInt(m) || 0) / 60;
        }
      } else if (typeof entry.hours === 'number') {
        hours = entry.hours;
      }

      if (entry.isActive && clockInTime) {
        const activeHours = (new Date().getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
        hours += activeHours;
      }
      
      if (!isNaN(hours) && hours > 0) {
        card.totalHours += hours;
        const amount = hours * hourlyRate;
        card.totalAmount += amount;

        if (entry.projectId) {
          const projectIndex = card.projects.findIndex(p => p.name === entry.projectName);
          if (projectIndex === -1) {
            card.projects.push({
              name: entry.projectName || 'Unnamed Project',
              hours: hours,
              amount: amount,
            });
            card.projectCount++;
          } else {
            card.projects[projectIndex].hours += hours;
            card.projects[projectIndex].amount += amount;
          }
        }
      }
    });

    const cards = Array.from(periodShifts.values())
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

    setWeeklyCards(cards);
  };

  const viewInvoice = async (startDate: Date, endDate: Date) => {
    try {
      // Find the invoice for these dates
      const matchingInvoice = invoices.find(inv => 
        new Date(inv.startDate).getTime() === startDate.getTime() &&
        new Date(inv.endDate).getTime() === endDate.getTime()
      );

      if (!matchingInvoice) {
        console.error('Invoice not found');
        return;
      }

      // Fetch invoice details and user config in parallel
      const [invoiceResponse, userConfigResponse] = await Promise.all([
        fetch(`/api/invoices?invoiceId=${matchingInvoice.id}`),
        fetch('/api/user-config')
      ]);
      
      const invoiceData = await invoiceResponse.json();
      const configData = await userConfigResponse.json();
      
      if (invoiceData.invoice) {
        // Get business info from user config
        let companyName = '';
        let companyEmail = '';
        let companyAddress = '';
        let companyPhone = '';
        let paymentTerms = '';
        let notes = '';
        let currency = 'USD';
        
        // Get business info from user config
        if (configData.userConfig) {
          companyName = configData.userConfig.businessName || '';
          companyEmail = configData.userConfig.email || '';
          companyAddress = [
            configData.userConfig.address,
            configData.userConfig.city && configData.userConfig.state ? 
              `${configData.userConfig.city}, ${configData.userConfig.state} ${configData.userConfig.zipCode || ''}` : 
              ''
          ].filter(Boolean).join('\n');
          companyPhone = configData.userConfig.phone || '';
        }
        
        // Get invoice settings
        if (configData.invoiceSettings) {
          // Add payment terms and other invoice-specific settings
          paymentTerms = configData.invoiceSettings.paymentTerms || '';
          notes = configData.invoiceSettings.defaultNotes || '';
          currency = configData.invoiceSettings.currency || 'USD';
        }
        
        // Generate PDF
        const doc = generateInvoicePDF({
          invoice: invoiceData.invoice,
          companyName,
          companyEmail,
          companyAddress,
          companyPhone,
          paymentTerms,
          notes,
          currency
        });

        // Download PDF
        doc.save(`invoice-${invoiceData.invoice.invoiceNumber}.pdf`);
      }
    } catch (error) {
      console.error('Error viewing invoice:', error);
    }
  };

  // Update stats every minute when clocked in
  useEffect(() => {
    if (clockedIn) {
      const statsTimer = setInterval(() => {
        // Only refetch shifts data while clocked in
        mutateShifts();
      }, 60000); // Update every minute
      return () => clearInterval(statsTimer);
    }
  }, [clockedIn, mutateShifts]);

  // Add function to delete a shift
  const deleteShift = async (shiftId: string) => {
    if (!session?.user?.id) return;
    
    // Confirm before deleting
    if (!confirm("Are you sure you want to delete this time entry? This action cannot be undone.")) {
      return;
    }
    
    try {
      const response = await fetch(`/api/timecard?shiftId=${shiftId}&userId=${session.user.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Refresh the shifts data
        mutateShifts();
        
        // Show success message
        alert("Time entry deleted successfully");
      } else {
        console.error('Failed to delete time entry');
      }
    } catch (error) {
      console.error('Error deleting time entry:', error);
    }
  };

  // Add function to open edit modal for a shift
  const openEditModal = (entry: TimeEntry) => {
    const clockInDate = new Date(entry.clockInTimestamp);
    const clockInDateString = clockInDate.toISOString().split('T')[0];
    const clockInTimeString = clockInDate.toTimeString().split(' ')[0].substring(0, 5);
    
    let clockOutDate = new Date();
    let clockOutTimeString = '';
    
    // If there's a clock out time, parse it
    if (entry.timeOut !== '-') {
      // Create a date from the entry date and timeOut
      const [hours, minutes] = entry.timeOut.split(':');
      clockOutDate = new Date(entry.clockInTimestamp);
      clockOutDate.setHours(parseInt(hours), parseInt(minutes));
      
      // If clock out time is earlier than clock in time, it's the next day
      if (clockOutDate.getTime() < clockInDate.getTime()) {
        clockOutDate.setDate(clockOutDate.getDate() + 1);
      }
      
      clockOutTimeString = clockOutDate.toTimeString().split(' ')[0].substring(0, 5);
    }
    
    setEditingEntry({
      id: entry.id,
      clockInDate: clockInDateString,
      clockInTime: clockInTimeString,
      clockOutDate: clockOutDate.toISOString().split('T')[0],
      clockOutTime: clockOutTimeString
    });
    
    setShowEditModal(true);
  };

  // Add function to save edited shift
  const saveEditedShift = async () => {
    if (!session?.user?.id || !editingEntry) return;
    
    try {
      // Format dates for API
      const clockInDateTime = new Date(`${editingEntry.clockInDate}T${editingEntry.clockInTime}`);
      let clockOutDateTime = null;
      
      if (editingEntry.clockOutTime) {
        clockOutDateTime = new Date(`${editingEntry.clockOutDate}T${editingEntry.clockOutTime}`);
      }
      
      // Validate that clock in is before clock out
      if (clockOutDateTime && clockInDateTime >= clockOutDateTime) {
        alert('Clock in time must be before clock out time');
        return;
      }
      
      const response = await fetch('/api/timecard/edit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          shiftId: editingEntry.id,
          clockInTime: clockInDateTime.toISOString(),
          clockOutTime: clockOutDateTime?.toISOString()
        }),
      });
      
      if (response.ok) {
        // Refresh the shifts data
        mutateShifts();
        setShowEditModal(false);
        setEditingEntry(null);
        
        // Show success message
        alert("Time entry updated successfully");
      } else {
        console.error('Failed to update time entry');
      }
    } catch (error) {
      console.error('Error updating time entry:', error);
    }
  };

  const handleGenerateInvoice = (card: WeeklyInvoiceCard) => {
    // Get date strings directly from the card
    const startDate = card.startDate.toISOString().split('T')[0];
    const endDate = card.endDate.toISOString().split('T')[0];
    
    // Update state for consistency (though we won't rely on it)
    setSelectedDateRange({
      startDate: startDate,
      endDate: endDate
    });

    // Call generate invoice with explicit dates rather than relying on state
    generateInvoice(startDate, endDate);
  };

  // Don't render anything while checking authentication
  if (status === "loading") {
    return <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#1e1b4b] text-[#f1f5f9] flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center">
        <div className="flex items-center space-x-3 mb-4">
          <img src="/logo.png" alt="NextTime Logo" className="w-8 h-8" />
          <div className="h-8 w-28 bg-[#334155] rounded-md"></div>
        </div>
        <div className="h-4 w-48 bg-[#334155] rounded"></div>
      </div>
    </div>;
  }

  // Don't render the page content if not authenticated
  if (!session) {
    return null;
  }

  // Render loading skeleton if data is still loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#1e1b4b] text-[#f1f5f9] py-6">
        <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <img src="/logo.png" alt="NextTime Logo" className="w-8 h-8" />
              <h1 className="text-3xl tracking-tight font-instrument-serif bg-clip-text text-transparent bg-gradient-to-r from-[#f9a8d4] to-[#93c5fd]">NextTime</h1>
            </div>
            
            {session?.user && (
              <div className="flex items-center space-x-4">
                {session.user.image && (
                  <img 
                    src={session.user.image} 
                    alt={session.user.name || 'User'} 
                    className="w-8 h-8 rounded-full border-2 border-[#64748b]/20"
                  />
                )}
                <div className="text-[#94a3b8] flex items-center space-x-2 group">
                  <span>{session.user.name}</span>
                </div>
              </div>
            )}
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#1e293b]/70 backdrop-blur-md rounded-xl border border-[#64748b]/20 p-6 shadow-xl shadow-[#6366f1]/5 h-96 animate-pulse">
                <div className="h-6 bg-[#334155] rounded w-1/3 mb-8"></div>
                <div className="space-y-4">
                  <div className="h-4 bg-[#334155] rounded w-full"></div>
                  <div className="h-4 bg-[#334155] rounded w-5/6"></div>
                  <div className="h-4 bg-[#334155] rounded w-4/6"></div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#1e1b4b] text-[#f1f5f9] py-6">
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="NextTime Logo" className="w-8 h-8" />
            <h1 className="text-3xl tracking-tight font-instrument-serif bg-clip-text text-transparent bg-gradient-to-r from-[#f9a8d4] to-[#93c5fd]">NextTime</h1>
          </div>
          
          {session?.user && (
            <div className="flex items-center space-x-4">
              {session.user.image && (
                <img 
                  src={session.user.image} 
                  alt={session.user.name || 'User'} 
                  className="w-8 h-8 rounded-full border-2 border-[#64748b]/20"
                />
              )}
              <Link 
                href="/settings"
                className="text-[#94a3b8] hover:text-[#f1f5f9] transition-colors cursor-pointer flex items-center space-x-2 group"
              >
                <span>{session.user.name}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </Link>
              <button
                onClick={() => signOut()}
                className="text-sm text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Left Column - Clock In/Out */}
          <div className="bg-[#1e293b]/70 backdrop-blur-md rounded-xl border border-[#64748b]/20 p-6 shadow-xl shadow-[#6366f1]/5 transition-all duration-300 hover:shadow-[#6366f1]/10">
            <div className="flex flex-col items-center mb-8">
              <h2 className="text-2xl font-instrument-serif font-light text-[#f1f5f9] mb-6">
                <span className="flex items-center">
                  <img src="/logo.png" alt="NextTime Logo" className="w-6 h-6 mr-2" />
                  Time Tracker
                </span>
              </h2>
              
              <div className="text-5xl font-geist-mono mb-7 text-[#f1f5f9] drop-shadow-md animate-[pulse_4s_ease-in-out_infinite]">
                {time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
              </div>
              
              {clockedIn && (
                <div className="text-3xl font-geist-mono mb-7 text-[#5eead4] drop-shadow animate-[fadeIn_0.5s_ease-in-out]">
                  {formatTime(timeElapsed)}
                </div>
              )}
              
              <button 
                onClick={toggleClock}
                className={`w-full py-4 px-6 rounded-lg font-medium text-white text-lg transition-all duration-300 shadow-lg transform hover:scale-[1.02] ${
                  clockedIn 
                    ? "bg-gradient-to-r from-[#f43f5e] to-[#ec4899] hover:from-[#e11d48] hover:to-[#db2777] shadow-[#f43f5e]/20" 
                    : "bg-gradient-to-r from-[#059669] to-[#0d9488] hover:from-[#047857] hover:to-[#0f766e] shadow-[#059669]/20"
                }`}
              >
                {clockedIn ? "Clock Out" : "Clock In"}
              </button>
            </div>
            
            <div className="border-t border-[#64748b]/20 pt-6">
              <h3 className="text-lg font-instrument-serif text-[#f1f5f9] mb-4">Today's Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-[#334155]/80 to-[#475569]/50 p-4 rounded-lg transition-all duration-300 hover:from-[#334155]/90 hover:to-[#475569]/60">
                  <p className="text-sm text-[#94a3b8] mb-1">Hours Today</p>
                  <p className="text-2xl font-geist-mono text-[#bae6fd]">{todayStats.hoursToday}</p>
                </div>
                <div className="bg-gradient-to-br from-[#334155]/80 to-[#475569]/50 p-4 rounded-lg transition-all duration-300 hover:from-[#334155]/90 hover:to-[#475569]/60">
                  <p className="text-sm text-[#94a3b8] mb-1">Week Total</p>
                  <p className="text-2xl font-geist-mono text-[#bae6fd]">{todayStats.weekTotal}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Middle Column - Time Entries */}
          <div className="bg-[#1e293b]/70 backdrop-blur-md rounded-xl border border-[#64748b]/20 p-6 shadow-xl shadow-[#6366f1]/5 transition-all duration-300 hover:shadow-[#6366f1]/10">
            <h2 className="text-2xl font-instrument-serif font-light text-[#f1f5f9] mb-6">Recent Time Entries</h2>
            
            <div className="space-y-5">
              {entries.map(entry => (
                <div key={entry.id} className="border-b border-[#64748b]/20 pb-5 last:border-0 hover:bg-[#334155]/30 transition-all duration-300 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-geist-mono text-[#94a3b8]">{entry.date}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-geist-mono text-[#5eead4]">{entry.hours}</span>
                      {!entry.isActive && (
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => openEditModal(entry)}
                            className="p-1.5 rounded-md text-[#a5b4fc] hover:bg-[#312e81]/30 transition-all duration-300"
                            aria-label="Edit time entry"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => deleteShift(entry.id)}
                            className="p-1.5 rounded-md text-[#fda4af] hover:bg-[#9f1239]/30 transition-all duration-300"
                            aria-label="Delete time entry"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center space-x-3">
                      <span className="bg-[#134e4a]/40 text-[#5eead4] px-3 py-1.5 rounded-md text-xs font-geist-mono border border-[#115e59]/30 transition-all hover:bg-[#134e4a]/50">In: {entry.timeIn}</span>
                      <span className="bg-[#9f1239]/40 text-[#fda4af] px-3 py-1.5 rounded-md text-xs font-geist-mono border border-[#881337]/30 transition-all hover:bg-[#9f1239]/50">Out: {entry.timeOut}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        {entry.projectId ? (
                          <div className="flex items-center space-x-2 group">
                            <div className="bg-[#1e3a8a]/30 text-[#93c5fd] px-3 py-1.5 rounded-md text-sm font-medium border border-[#1e40af]/20 transition-all group-hover:bg-[#1e3a8a]/40">
                              <span>{entry.projectName}</span>
                            </div>
                            {entry.projectLink && (
                              <a 
                                href={entry.projectLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#60a5fa] hover:text-[#93c5fd] transition-all duration-300 transform hover:scale-110 opacity-0 group-hover:opacity-100"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                </svg>
                              </a>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingShiftId(entry.id)}
                            className="text-sm text-[#94a3b8] hover:text-[#f1f5f9] transition-all duration-300 hover:translate-x-1"
                          >
                            + Assign Project
                          </button>
                        )}
                      </div>
                      <button 
                        onClick={() => setEditingShiftId(entry.id)}
                        className="ml-3 text-[#94a3b8] hover:text-[#f1f5f9] transition-all duration-300 transform hover:scale-110"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Project Assignment Dropdown */}
                    {editingShiftId === entry.id && (
                      <div className="mt-2 animate-slideDown">
                        <div className="bg-[#1e293b] rounded-lg border border-[#64748b]/20 p-4 shadow-lg">
                          <div className="flex flex-col space-y-3">
                            <select
                              className="bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 text-sm border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                              value={entry.projectId || ''}
                              onChange={(e) => assignProject(entry.id, e.target.value)}
                            >
                              <option value="">Select Project</option>
                              {projects.map(project => (
                                <option key={project.id} value={project.id}>
                                  {project.name}
                                </option>
                              ))}
                            </select>
                            <div className="flex justify-between items-center">
                              <button
                                onClick={() => setEditingShiftId(null)}
                                className="text-sm text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => setShowProjectModal(true)}
                                className="text-sm text-[#60a5fa] hover:text-[#93c5fd] transition-all duration-300 transform hover:translate-x-1 flex items-center space-x-1"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                <span>New Project</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <button className="mt-6 w-full py-2.5 px-4 border border-[#6366f1]/30 rounded-lg text-sm font-medium text-[#f1f5f9] bg-[#334155]/50 hover:bg-[#475569]/50 transition-all duration-300 hover:border-[#818cf8]/40 transform hover:translate-y-[-2px]">
              View All Entries
            </button>
          </div>
          
          {/* Right Column - Invoice Management */}
          <div className="bg-[#1e293b]/70 backdrop-blur-md rounded-xl border border-[#64748b]/20 p-6 shadow-xl shadow-[#6366f1]/5">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-light text-[#f1f5f9]">Invoices</h2>
                <div className="flex bg-[#0f172a]/50 rounded-lg p-0.5">
                  <button
                    onClick={() => setInvoicePeriod('weekly')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-300 ${
                      invoicePeriod === 'weekly'
                        ? 'bg-[#3b82f6] text-white'
                        : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setInvoicePeriod('biweekly')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-300 ${
                      invoicePeriod === 'biweekly'
                        ? 'bg-[#3b82f6] text-white'
                        : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                    }`}
                  >
                    Biweekly
                  </button>
                  <button
                    onClick={() => setInvoicePeriod('monthly')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-300 ${
                      invoicePeriod === 'monthly'
                        ? 'bg-[#3b82f6] text-white'
                        : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                    }`}
                  >
                    Monthly
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-all duration-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {weeklyCards.map((card, index) => (
                <div key={index} className="border border-[#64748b]/20 rounded-lg p-4 hover:bg-[#1e293b] transition-all duration-300">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-[#f1f5f9] font-medium">
                        Week of {card.startDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                      </h3>
                      <p className="text-xs text-[#94a3b8] mt-0.5">
                        {card.startDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })} - {card.endDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#f1f5f9] font-medium">{formatCurrency(card.totalAmount)}</p>
                      <div className="flex items-center gap-2 text-xs text-[#94a3b8] mt-0.5">
                        <span>{card.totalHours.toFixed(2)} hours</span>
                        <span>•</span>
                        <span>{card.projectCount} {card.projectCount === 1 ? 'project' : 'projects'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Project List */}
                  <div className="mt-3 space-y-2">
                    {card.projects.map((project, pIndex) => (
                      <div key={pIndex} className="flex justify-between items-center text-sm">
                        <span className="text-[#94a3b8] text-xs">{project.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-[#5eead4] text-xs">{project.hours.toFixed(1)}h</span>
                          <span className="text-[#94a3b8] text-xs">{formatCurrency(project.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => handleGenerateInvoice(card)}
                    className="w-full mt-4 py-2 text-sm text-center text-[#94a3b8] bg-[#0f172a]/50 hover:bg-[#0f172a] rounded-md transition-all duration-300"
                  >
                    Generate Invoice
                  </button>
                </div>
              ))}

              {weeklyCards.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-[#94a3b8] text-sm">No time entries found</p>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </main>
      
      {/* New Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-[#1e293b] p-6 rounded-xl w-full max-w-md mx-4 shadow-2xl shadow-black/20 animate-slideUp">
            <div className="flex items-center space-x-2 mb-6">
              <img src="/logo.png" alt="NextTime Logo" className="w-5 h-5" />
              <h3 className="text-xl font-instrument-serif text-[#f1f5f9]">New Project</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="projectName" className="block text-sm text-[#94a3b8] mb-1">Project Name</label>
                <input
                  id="projectName"
                  type="text"
                  placeholder="Enter project name"
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                  value={newProject.name}
                  onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="projectLink" className="block text-sm text-[#94a3b8] mb-1">Project Link (optional)</label>
                <input
                  id="projectLink"
                  type="text"
                  placeholder="https://..."
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                  value={newProject.link}
                  onChange={(e) => setNewProject(prev => ({ ...prev, link: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowProjectModal(false)}
                className="px-4 py-2 text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createProject}
                className="px-4 py-2 bg-gradient-to-r from-[#3b82f6] to-[#60a5fa] text-white rounded-md hover:from-[#2563eb] hover:to-[#3b82f6] transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-[#3b82f6]/20"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Generation Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-[#1e293b] p-6 rounded-xl w-full max-w-md mx-4 shadow-2xl shadow-black/20 animate-slideUp">
            <div className="flex items-center space-x-2 mb-6">
              <img src="/logo.png" alt="NextTime Logo" className="w-5 h-5" />
              <h3 className="text-xl font-instrument-serif text-[#f1f5f9]">Generate Custom Invoice</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Start Date</label>
                <input
                  type="date"
                  value={selectedDateRange.startDate}
                  onChange={(e) => setSelectedDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">End Date</label>
                <input
                  type="date"
                  value={selectedDateRange.endDate}
                  onChange={(e) => setSelectedDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Select Projects</label>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {projects.map(project => (
                    <label key={project.id} className="flex items-center space-x-2 p-2 hover:bg-[#334155]/40 rounded transition-colors">
                      <input
                        type="checkbox"
                        className="rounded border-[#64748b]/20 text-[#3b82f6] focus:ring-[#60a5fa]/10"
                      />
                      <span className="text-[#f1f5f9]">{project.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="px-4 py-2 text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedDateRange.startDate && selectedDateRange.endDate) {
                    generateInvoice();
                  }
                }}
                disabled={!selectedDateRange.startDate || !selectedDateRange.endDate}
                className="px-4 py-2 bg-gradient-to-r from-[#3b82f6] to-[#60a5fa] text-white rounded-md hover:from-[#2563eb] hover:to-[#3b82f6] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-[#3b82f6]/20"
              >
                Generate Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Edit Time Entry Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e293b] border border-[#64748b]/30 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-instrument-serif text-[#f1f5f9] mb-6">Edit Time Entry</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Clock In Date</label>
                <input
                  type="date"
                  value={editingEntry?.clockInDate || ''}
                  onChange={(e) => setEditingEntry(prev => prev ? {...prev, clockInDate: e.target.value} : null)}
                  className="w-full bg-[#334155] border border-[#475569] rounded-md px-3 py-2 text-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Clock In Time</label>
                <input
                  type="time"
                  value={editingEntry?.clockInTime || ''}
                  onChange={(e) => setEditingEntry(prev => prev ? {...prev, clockInTime: e.target.value} : null)}
                  className="w-full bg-[#334155] border border-[#475569] rounded-md px-3 py-2 text-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Clock Out Date</label>
                <input
                  type="date"
                  value={editingEntry?.clockOutDate || ''}
                  onChange={(e) => setEditingEntry(prev => prev ? {...prev, clockOutDate: e.target.value} : null)}
                  className="w-full bg-[#334155] border border-[#475569] rounded-md px-3 py-2 text-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>
              
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Clock Out Time</label>
                <input
                  type="time"
                  value={editingEntry?.clockOutTime || ''}
                  onChange={(e) => setEditingEntry(prev => prev ? {...prev, clockOutTime: e.target.value} : null)}
                  className="w-full bg-[#334155] border border-[#475569] rounded-md px-3 py-2 text-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingEntry(null);
                }}
                className="flex-1 py-2 px-4 bg-[#475569] hover:bg-[#64748b] rounded-md text-sm font-medium text-[#f1f5f9] transition-all duration-300"
              >
                Cancel
              </button>
              <button
                onClick={saveEditedShift}
                className="flex-1 py-2 px-4 bg-gradient-to-r from-[#4f46e5] to-[#6366f1] hover:from-[#4338ca] hover:to-[#4f46e5] rounded-md text-sm font-medium text-white transition-all duration-300"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.4s ease-out;
        }

        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}




