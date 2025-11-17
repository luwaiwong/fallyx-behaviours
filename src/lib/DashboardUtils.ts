type ColorStatus = 'red' | 'default';
type ShiftName = 'Morning' | 'Evening' | 'Night';
type TimeShiftResult = ShiftName | 'Unknown';
type WeekdayName =
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday';

export interface FallRecord {
  id: number | string;
  date?: string;
  time?: string;
  name?: string;
  postFallNotes?: string | number | null;
  transfer_to_hospital?: string | null;
  poaContacted?: string | null;
  location?: string | null;
  incident_location?: string | null;
  hir?: string | null;
  homeUnit?: string | null;
  room?: string | null;
  injury?: string | null;
  [key: string]: unknown;
}

export interface FallRecordWithColors extends FallRecord {
  postFallNotesColor?: ColorStatus;
  poaContactedColor?: ColorStatus;
}

type ShiftRange = [number, number];

interface TimeShiftConfig {
  morning: ShiftRange;
  evening: ShiftRange;
  night: ShiftRange;
}

const isWithinRange = (value: number, [start, end]: ShiftRange): boolean => {
  if (start <= end) {
    return value >= start && value <= end;
  }
  return value >= start || value <= end;
};

export function markPostFallNotes(input: FallRecordWithColors[]): FallRecordWithColors[] {
  console.log('markPostFallNotes is being called with data:', input);
  const data = [...input];
  data.sort((a, b) => {
    const aTimestamp = new Date(`${a.date ?? ''} ${a.time ?? ''}`).getTime();
    const bTimestamp = new Date(`${b.date ?? ''} ${b.time ?? ''}`).getTime();
    return aTimestamp - bTimestamp;
  });

  data.forEach((currentRecord) => {
    const currentID = currentRecord.id;
    if (currentID === undefined || currentID === null) {
      return;
    }

    const recordIndex =
      typeof currentID === 'number' ? currentID : Number.parseInt(String(currentID), 10);
    if (Number.isNaN(recordIndex)) {
      return;
    }

    const targetRecord = input[recordIndex];
    if (!targetRecord) {
      return;
    }

    const postFallNotesCount = Number(currentRecord.postFallNotes ?? 0);
    const transferValue =
      typeof currentRecord.transfer_to_hospital === 'string'
        ? currentRecord.transfer_to_hospital.toLowerCase()
        : '';
    const notHospitalized = transferValue === 'no';

    console.log('Checking conditions:', {
      name: currentRecord.name,
      postFallNotes: postFallNotesCount,
      transfer_to_hospital: currentRecord.transfer_to_hospital,
      notHospitalized,
      poaContacted: currentRecord.poaContacted,
    });

    targetRecord.postFallNotesColor =
      postFallNotesCount < 3 && notHospitalized ? 'red' : 'default';

    const poaValue =
      typeof currentRecord.poaContacted === 'string'
        ? currentRecord.poaContacted.toLowerCase()
        : '';
    targetRecord.poaContactedColor = poaValue === 'no' ? 'red' : 'default';
  });

  return input;
}

export function countFallsByExactInjury(data: FallRecord[]): Record<string, number> {
  const injuryCounts: Record<string, number> = {};

  data.forEach((fall) => {
    const injury = (fall.injury ?? 'Unknown') as string;
    injuryCounts[injury] = (injuryCounts[injury] ?? 0) + 1;
  });

  return injuryCounts;
}

export function countFallsByLocation(
  data: Record<string, FallRecord> | FallRecord[]
): Record<string, number> {
  const locationCounts: Record<string, number> = {};
  const records = Array.isArray(data) ? data : Object.values(data);

  records.forEach((item) => {
    const locationValue = (item.location ?? item.incident_location) as string | undefined;
    if (locationValue) {
      locationCounts[locationValue] = (locationCounts[locationValue] ?? 0) + 1;
    }
  });

  console.log('Location counts:', locationCounts);
  return locationCounts;
}

export function countFallsByHIR(data: FallRecord[]): number {
  let hirCount = 0;
  data.forEach((item) => {
    try {
      const hirValue = typeof item.hir === 'string' ? item.hir.toLowerCase() : '';
      if (hirValue === 'yes') {
        hirCount++;
      }
    } catch (error) {
      console.error('Error processing HIR:', error);
    }
  });
  return hirCount;
}

export function getMonthFromTimeRange(timeRange: '3months' | '6months' | string): string {
  // Example logic for determining the month label
  // Replace this logic with the actual month logic you are using
  const currentMonth = 'August 2024'; // You can dynamically determine this based on the current time or input data
  if (timeRange === '3months') {
    return 'June - August 2024';
  } else if (timeRange === '6months') {
    return 'March - August 2024';
  } else {
    return currentMonth;
  }
}

export function getTimeShift(
  fallTime: string | null | undefined,
  home: string
): TimeShiftResult {
  console.log('Analyzing time:', fallTime, 'for home:', home);

  if (!fallTime) {
    return 'Unknown';
  }

  try {
    if (!fallTime.includes(':')) {
      return 'Unknown';
    }

    const [hourPart, minutePart] = fallTime.split(':');
    const hours = Number.parseInt(hourPart, 10);
    const minutes = Number.parseInt(minutePart ?? '0', 10);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      console.log('Invalid time format:', fallTime);
      return 'Unknown';
    }

    const totalMinutes = hours * 60 + minutes;
    console.log('Total minutes:', totalMinutes);

    if (home.toLowerCase() === 'goderich') {
      if (totalMinutes >= 420 && totalMinutes <= 899) return 'Morning';
      if (totalMinutes >= 900 && totalMinutes <= 1379) return 'Evening';
      if (totalMinutes >= 1380 || totalMinutes <= 419) return 'Night';
      console.log(`Time ${fallTime} (${totalMinutes} minutes) outside shift ranges`);
      return 'Unknown';
    }

    const timeShifts: Record<string, TimeShiftConfig> = {
      iggh: {
        morning: [420, 900],
        evening: [901, 1380],
        night: [1381, 419],
      },
      millCreek: {
        morning: [390, 870],
        evening: [871, 1350],
        night: [1351, 389],
      },
      niagara: {
        morning: [360, 840],
        evening: [841, 1320],
        night: [1321, 359],
      },
      wellington: {
        morning: [390, 870],
        evening: [871, 1350],
        night: [1351, 389],
      },
      home1: {
        morning: [420, 900],
        evening: [901, 1380],
        night: [1381, 419],
      },
      home2: {
        morning: [420, 900],
        evening: [901, 1380],
        night: [1381, 419],
      },
      home3: {
        morning: [420, 900],
        evening: [901, 1380],
        night: [1381, 419],
      },
      home4: {
        morning: [420, 900],
        evening: [901, 1380],
        night: [1381, 419],
      },
      bonairltc: {
        morning: [390, 869],
        evening: [870, 1349],
        night: [1350, 389],
      },
      champlain: {
        morning: [360, 839],
        evening: [840, 1319],
        night: [1320, 359],
      },
      lancaster: {
        morning: [360, 839],
        evening: [840, 1319],
        night: [1320, 359],
      },
      oneill: {
        morning: [420, 899],
        evening: [900, 1379],
        night: [1380, 419],
      },
      vmltc: {
        morning: [420, 899],
        evening: [900, 1379],
        night: [1380, 419],
      },
      generations: {
        morning: [420, 899],
        evening: [900, 1379],
        night: [1380, 419],
      },
      generationltc: {
        morning: [420, 899],
        evening: [900, 1379],
        night: [1380, 419],
      },
      goderich: {
        morning: [420, 899],
        evening: [900, 1379],
        night: [1380, 419],
      },
      palisade: {
        morning: [420, 899],
        evening: [900, 1379],
        night: [1380, 419],
      },
      shepherd: {
        morning: [420, 899],
        evening: [900, 1379],
        night: [1380, 419],
      },
      domlipa: {
        morning: [420, 899],
        evening: [900, 1379],
        night: [1380, 419],
      },
      srr: {
        morning: [420, 899],
        evening: [900, 1379],
        night: [1380, 419],
      },
      wellbrook_east: {
        morning: [420, 899],
        evening: [900, 1379],
        night: [1380, 419],
      },
      wellbrook_west: {
        morning: [420, 899],
        evening: [900, 1379],
        night: [1380, 419],
      },
      southview_acres: {
        morning: [420, 899],
        evening: [900, 1379],
        night: [1380, 419],
      },
    };

    const shiftConfig =
      timeShifts[home as keyof typeof timeShifts] ??
      timeShifts[home.toLowerCase() as keyof typeof timeShifts];

    if (!shiftConfig) {
      console.error(`No configuration found for home: ${home}`);
      return 'Unknown';
    }

    if (isWithinRange(totalMinutes, shiftConfig.morning)) {
      return 'Morning';
    }
    if (isWithinRange(totalMinutes, shiftConfig.evening)) {
      return 'Evening';
    }
    if (isWithinRange(totalMinutes, shiftConfig.night)) {
      return 'Night';
    }

    console.error(`Time ${fallTime} does not match any shift for home: ${home}`);
    return 'Unknown';
  } catch (error) {
    console.error('Error processing time:', error);
    return 'Unknown';
  }
}

export function countResidentsWithRecurringFalls(data: FallRecord[]): Record<string, number> {
  const residentFallCounts: Record<string, number> = {};

  data.forEach((fall) => {
    const residentName = fall.name ?? 'Unknown';
    residentFallCounts[residentName] = (residentFallCounts[residentName] ?? 0) + 1;
  });

  const recurringFalls: Record<string, number> = {};
  Object.entries(residentFallCounts).forEach(([resident, count]) => {
    if (count > 1) {
      recurringFalls[resident] = count;
    }
  });

  return recurringFalls;
}

export function countFallsByTimeOfDay(
  data: FallRecord[],
  name: string
): Record<ShiftName, number> {
  const timeOfDayCounts: Record<ShiftName, number> = { Morning: 0, Evening: 0, Night: 0 };

  data.forEach((fall) => {
    const shift = getTimeShift(fall.time as string | null | undefined, name);
    if (shift === 'Morning' || shift === 'Evening' || shift === 'Night') {
      timeOfDayCounts[shift] += 1;
    }
  });

  return timeOfDayCounts;
}

export function countFallsByUnit(data: FallRecord[]): Record<string, number> {
  const unitCounts: Record<string, number> = {};
  
  data.forEach((fall) => {
    const unit = (fall.homeUnit ?? fall.room) as string | undefined;
    
    if (unit) {
      const trimmedUnit = unit.trim();
      if (trimmedUnit) {
        unitCounts[trimmedUnit] = (unitCounts[trimmedUnit] ?? 0) + 1;
      }
    }
  });
  
  return unitCounts;
}

export function countFallsByDayOfWeek(data: FallRecord[]): Record<WeekdayName, number> {
  const dayCounts: Record<WeekdayName, number> = {
    Sunday: 0,
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
    Saturday: 0,
  };
  
  data.forEach((fall) => {
    if (!fall.date) {
      return;
    }

    const [year, month, day] = fall.date.split('-').map(Number);
    if ([year, month, day].some((value) => Number.isNaN(value))) {
      return;
    }

    const date = new Date(year, (month ?? 1) - 1, day);
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }) as WeekdayName;
    if (dayOfWeek in dayCounts) {
      dayCounts[dayOfWeek] += 1;
    }
  });
  
  return dayCounts;
}

export function countFallsByHour(data: FallRecord[]): Record<number, number> {
  const hourCounts: Record<number, number> = {};
  
  for (let i = 0; i < 24; i++) {
    hourCounts[i] = 0;
  }
  
  data.forEach((fall) => {
    if (!fall.time) {
      return;
    }

    const [hourPart] = fall.time.split(':');
    const hour = Number.parseInt(hourPart ?? '', 10);
    if (!Number.isNaN(hour) && hour >= 0 && hour <= 23) {
      hourCounts[hour] += 1;
    }
  });
  
  return hourCounts;
}
