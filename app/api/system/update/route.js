import { NextResponse } from 'next/server';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import versionData from '@/version.json';
import { getUpdateStatus, setUpdateStatus, resetUpdateStatus } from '@/lib/updateStatus';

export const dynamic = 'force-dynamic';

function getLocalCommit() {
  // 1. Try git CLI
  try {
    return execSync('git rev-parse --short HEAD', { timeout: 3000 }).toString().trim();
  } catch (err) {}

  // 2. Try data/version.json (persisted volume)
  try {
    const dataVersionPath = path.join(process.cwd(), 'data/version.json');
    if (fs.existsSync(dataVersionPath)) {
      const parsed = JSON.parse(fs.readFileSync(dataVersionPath, 'utf8'));
      if (parsed?.commit) return parsed.commit;
    }
  } catch (e) {}

  // 3. Try bundled version.json
  if (versionData?.commit && versionData.commit !== 'unknown') {
    return versionData.commit;
  }

  // 4. Try reading .git/HEAD
  try {
    const gitHeadPath = path.join(process.cwd(), '.git/HEAD');
    if (fs.existsSync(gitHeadPath)) {
      const head = fs.readFileSync(gitHeadPath, 'utf8').trim();
      if (head.startsWith('ref: ')) {
        const refPath = path.join(process.cwd(), '.git', head.slice(5));
        if (fs.existsSync(refPath)) {
          return fs.readFileSync(refPath, 'utf8').trim().slice(0, 7);
        }
      }
      return head.slice(0, 7);
    }
  } catch (e) {}

  return 'unknown';
}

export async function GET() {
  const currentCommit = getLocalCommit();
  let latestCommit = null;
  let hasUpdate = false;
  let commitMessage = '';
  const isDocker = fs.existsSync('/.dockerenv');

  try {
    const res = await fetch('https://api.github.com/repos/SnapplezOsev/EventopiaDashboard/commits/main', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'EventopiaDashboard-Kiosk',
      },
      next: { revalidate: 0 },
    });

    if (res.ok) {
      const data = await res.json();
      latestCommit = data.sha?.slice(0, 7) || null;
      commitMessage = data.commit?.message?.split('\n')[0] || '';
      if (latestCommit && currentCommit !== 'unknown') {
        hasUpdate = currentCommit !== latestCommit;
      }
    }
  } catch (err) {
    console.warn('Could not check GitHub for updates:', err.message);
  }

  const updateStatus = getUpdateStatus();

  return NextResponse.json({
    currentCommit,
    latestCommit: latestCommit || currentCommit,
    commitMessage,
    hasUpdate,
    isDocker,
    updateStatus,
    checkedAt: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
  });
}

export async function POST() {
  try {
    const isLinux = process.platform === 'linux';
    const isDocker = fs.existsSync('/.dockerenv');

    if (isDocker) {
      return NextResponse.json({
        success: false,
        isDocker: true,
        message: 'Dashboarden körs i en lokal Docker-container. Automatisk systemd-uppdatering stöds i kiosk-miljön på NUC:en. För att bygga och starta om med senaste koden lokalt, kör "docker compose up -d --build" i terminalen.',
      }, { status: 400 });
    }

    if (isLinux) {
      const candidates = [
        '/opt/eventopia-dashboard/deploy/update.sh',
        path.join(process.cwd(), 'deploy/update.sh'),
      ];
      const script = candidates.find(p => fs.existsSync(p));

      if (script) {
        // Set initial status so UI starts tracking immediately
        setUpdateStatus({
          status: 'running',
          stage: 'starting',
          message: 'Startar uppdateringsskript...',
          progress: 5,
          startedAt: Date.now(),
          error: null
        });

        // Trigger update script with sudo bash
        const child = spawn('sudo', ['bash', script, '--force']);
        let childErr = '';
        child.stderr?.on('data', (d) => {
          childErr += d.toString();
        });
        child.on('error', (err) => {
          setUpdateStatus({
            status: 'error',
            stage: 'failed',
            message: `Kunde inte starta uppdatering: ${err.message}`,
            progress: 0,
            error: err.message,
          });
        });
        child.on('exit', (code) => {
          if (code !== 0) {
            setUpdateStatus({
              status: 'error',
              stage: 'failed',
              message: `Uppdateringsskriptet avbröts (kod ${code}): ${childErr.trim() || 'Saknas sudo utan lösenord för eventopia?'}`,
              progress: 0,
              error: childErr.trim() || `Exit code ${code}`,
            });
          }
        });
        child.unref();

        return NextResponse.json({
          success: true,
          message: 'Uppdatering påbörjad.',
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'Kunde inte hitta deploy/update.sh på enheten.',
        }, { status: 404 });
      }
    }

    return NextResponse.json({
      success: false,
      message: 'Lokal miljö (Windows): Automatisk uppdatering stöds endast på Linux (NUC).',
    }, { status: 400 });
  } catch (err) {
    console.error('Trigger update error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  resetUpdateStatus();
  return NextResponse.json({ success: true });
}
