import { NextResponse } from 'next/server';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function getLocalCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { timeout: 3000 }).toString().trim();
  } catch (err) {
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
}

export async function GET() {
  const currentCommit = getLocalCommit();
  let latestCommit = null;
  let hasUpdate = false;
  let commitMessage = '';

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

  return NextResponse.json({
    currentCommit,
    latestCommit: latestCommit || currentCommit,
    commitMessage,
    hasUpdate,
    checkedAt: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
  });
}

export async function POST() {
  try {
    const isLinux = process.platform === 'linux';
    const isDocker = fs.existsSync('/.dockerenv');

    if (isDocker) {
      return NextResponse.json({
        success: true,
        message: 'Dashboarden körs i Docker. Kör "docker compose up -d --build" för att bygga och starta om med senaste koden.',
      });
    }

    if (isLinux) {
      const candidates = [
        '/opt/eventopia-dashboard/deploy/update.sh',
        path.join(process.cwd(), 'deploy/update.sh'),
      ];
      const script = candidates.find(p => fs.existsSync(p));

      if (script) {
        // Trigger update script with sudo bash
        const child = spawn('sudo', ['bash', script, '--force'], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();

        return NextResponse.json({
          success: true,
          message: 'Uppdatering påbörjad! NUC:en bygger om appen. Sidan laddas om automatiskt.',
        });
      } else {
        return NextResponse.json({
          error: 'Kunde inte hitta deploy/update.sh på enheten.',
        }, { status: 404 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Lokal miljö (Windows): Uppdatera via "git pull" och "npm run build" / omstart av container.',
    });
  } catch (err) {
    console.error('Trigger update error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
