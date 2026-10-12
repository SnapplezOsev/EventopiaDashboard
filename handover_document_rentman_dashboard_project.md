# Handover Document: Rentman Touch Dashboard

## 1. Project Overview & Goal
We are building an interactive, operational dashboard meant to run on an all-in-one touch TV driven by an Intel NUC located in the office. 
The primary use case is providing a clear weekly overview during weekly Tuesday planning meetings, allowing team members to review events, tasks, and tap on unassigned items to assign staff/freelancers directly from the touch interface.

### Core Requirements
* **Hardware/UI:** Wall-mounted Touch TV + NUC running 24/7.
* **Cost Constraints:** $0 additional software cost. Self-hosted on Docker.
* **Tech Stack:** Next.js (App Router), React, Tailwind CSS, Docker.
* **Integrations:** Rentman API (v1 or v3 depending on account setup).

---

## 2. Key Requirements & Features

### Weekly Operational View
* **7-Day Grid:** Static Monday–Sunday column view displaying deliveries, rig/de-rig, meetings, and events.
* **Cards & Details:** Displays Activity/Type, Time, Customer/Project Name, Location, and Assigned Crew/Status.
* **Responsive Fallback:** If high event density makes 7 days unreadable, implement a rolling 3-day view or swipeable carousel.

### Task Management
* **Tasks List:** Displays active tasks pulled directly from Rentman's native task manager.

### Interactive Crew Assignment
* **Touch-Friendly Modal:** Tapping an event/function opens a full-screen overlay/modal.
* **Crew Selection:** Large dropdown or search input to quickly assign internal staff (approx. 5) or external freelancers.
* **Write Back:** POSTs/PUTs the update back to Rentman API to keep both systems in sync.

---

## 3. Architecture & Technical Setup

```
   ┌─────────────────────────────────────────────────────────┐
   │                       Intel NUC                         │
   │  ┌───────────────────────────────────────────────────┐  │
   │  │                 Docker Container                  │  │
   │  │  ┌──────────────────┐       ┌──────────────────┐  │  │
   │  │  │  Next.js Frontend│ ────> │ Next.js API Route│  │  │
   │  │  │  (Tailwind UI)   │       │  (Backend Proxy) │  │  │
   │  └──┴──────────────────┴───────┴────────┬─────────┴──┴──┘
   └─────────────────────────────────────────┼───────────────┘
                                             │ HTTPS / Bearer
                                             ▼
                                     ┌───────────────┐
                                     │  Rentman API  │
                                     └───────────────┘
```

### Why Next.js?
1. **API Key Security:** Hides Rentman API tokens from client-side network traffic.
2. **CORS Handling:** Eliminates direct cross-origin issues from TV browser.
3. **Single Container:** Easy deployment via standard Docker containers.

---

## 4. Current Code Base / Boilerplate

### `docker-compose.yml`
```yaml
version: '3.8'
services:
  rentman-dashboard:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    restart: always
```

### `Dockerfile`
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### `.env.local`
```env
RENTMAN_API_TOKEN=your_rentman_api_token_here
RENTMAN_API_BASE_URL=https://api.rentman.net/v1
```

### `app/api/schedule/route.js` (Backend API Proxy)
```javascript
import { NextResponse } from 'next/server';

export async function GET(request) {
  const baseUrl = process.env.RENTMAN_API_BASE_URL || 'https://api.rentman.net/v1';
  const token = process.env.RENTMAN_API_TOKEN;

  try {
    const [projectsRes, tasksRes, crewRes] = await Promise.all([
      fetch(`${baseUrl}/projects`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${baseUrl}/tasks`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${baseUrl}/crew`, { headers: { Authorization: `Bearer ${token}` } })
    ]);

    const projects = await projectsRes.json();
    const tasks = await tasksRes.json();
    const crew = await crewRes.json();

    return NextResponse.json({
      schedule: projects.data || [],
      tasks: tasks.data || [],
      crew: crew.data || []
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch Rentman data' }, { status: 500 });
  }
}

export async function POST(request) {
  const baseUrl = process.env.RENTMAN_API_BASE_URL || 'https://api.rentman.net/v1';
  const token = process.env.RENTMAN_API_TOKEN;
  const body = await request.json();
  const { functionId, crewId } = body;

  try {
    // Example PUT/POST endpoint structure for Rentman crew assignment
    const response = await fetch(`${baseUrl}/projectcrew`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        function: functionId,
        crew: crewId
      })
    });

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update crew assignment' }, { status: 500 });
  }
}
```

### `app/page.js` (Touch UI)
```jsx
'use client';
import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [data, setData] = useState({ schedule: [], tasks: [], crew: [] });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const days = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];

  const fetchData = async () => {
    try {
      const res = await fetch('/api/schedule');
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto refresh every 5 minutes
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, []);

  const handleAssignCrew = async (crewId) => {
    if (!selectedEvent) return;
    
    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ functionId: selectedEvent.id, crewId })
    });

    setSelectedEvent(null);
    fetchData(); // Refresh UI
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 font-sans select-none">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
        <h1 className="text-4xl font-bold tracking-tight">Operativ Översikt</h1>
        <div className="text-xl text-gray-400">
          {new Date().toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </header>

      {/* 7-Day Grid */}
      <div className="grid grid-cols-7 gap-4 h-[75vh]">
        {days.map((day) => (
          <div key={day} className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 flex flex-col gap-3">
            <h2 className="text-2xl font-bold border-b border-gray-700 pb-2 text-blue-400 text-center">{day}</h2>
            
            <div className="flex-1 overflow-y-auto space-y-3">
              {/* Event Card Example */}
              <div 
                onClick={() => setSelectedEvent({ id: 101, title: 'Leverans: Event X', client: 'Företag AB' })}
                className="bg-gray-700/80 hover:bg-gray-700 p-4 rounded-lg cursor-pointer transition border border-gray-600 active:scale-95"
              >
                <span className="text-xs font-semibold bg-blue-900/80 text-blue-200 px-2 py-0.5 rounded">08:00 - 12:00</span>
                <div className="font-bold text-lg mt-1">Leverans: Event X</div>
                <div className="text-sm text-gray-300 mt-1">Företag AB</div>
                <div className="mt-2 flex justify-between items-center text-xs">
                  <span className="bg-red-900/80 text-red-200 px-2 py-1 rounded font-medium">Ej tilldelad</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Touch Modal for Crew Assignment */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-gray-800 border border-gray-700 p-8 rounded-2xl max-w-xl w-full shadow-2xl">
            <h3 className="text-3xl font-bold mb-2">Tilldela Personal</h3>
            <p className="text-gray-400 mb-6 text-lg">{selectedEvent.title} ({selectedEvent.client})</p>
            
            <div className="space-y-4 mb-8">
              <label className="block text-sm font-medium text-gray-300">Välj medarbetare / frilansare</label>
              <select 
                className="w-full text-2xl p-4 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none"
                onChange={(e) => handleAssignCrew(e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>Tryck för att välja...</option>
                {data.crew.map((person) => (
                  <option key={person.id} value={person.id}>{person.firstname} {person.lastname}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => setSelectedEvent(null)}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold py-4 rounded-xl transition"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 5. Next Steps for Next Session

1. **Rentman API Version Check:** Confirm whether Rentman API `v1` or `v3` endpoints are active on the account.
2. **Data Mapping:** Align exact fields (`projectfunctions`, `subprojects`, `crew`, `tasks`) with Rentman's JSON schema response.
3. **Tasks Component:** Build out the sidebar/bottom container for Rentman tasks.
4. **Kiosk Mode Setup:** Configure Chromium / Firefox on NUC to launch in `--kiosk` mode pointing to `http://localhost:3000`.