/**
 * Electron Main Process - botame-admin
 */

import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { join } from 'path';
import { config } from 'dotenv';
import { PlaybookService } from './services/playbook.service';
import { RecordingService } from './services/recording.service';
import { SupabaseService } from './services/supabase.service';
import { AISelectorService } from './services/ai-selector.service';
import { PlaybookRunnerService } from './services/playbook-runner.service';
import { BrowserService } from './services/browser.service';
import { getAutoUpdateService } from './services/auto-update.service';
import { getErrorHandler } from './errors/handler';
import { getCredentialsService } from './services/credentials.service';
import { FatalError } from './errors/base';
import { Playbook } from '../shared/types';
import { configLoader } from '../shared/config';
import * as path from 'path';

// Load .env file
config();

// 프로필 디렉토리 설정
const profilesDir = path.join(app.getAppPath(), 'profiles');
configLoader.initialize(profilesDir).catch(console.error);

// Linux IME (fcitx) support
app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform');
app.commandLine.appendSwitch('ozone-platform', 'x11');
app.commandLine.appendSwitch('gtk-version', '3');
app.commandLine.appendSwitch('enable-wayland-ime');

// Disable GPU (WSL2 compatibility)
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

let mainWindow: BrowserWindow | null = null;
let playbookService: PlaybookService;
let recordingService: RecordingService;
let supabaseService: SupabaseService;
let runnerService: PlaybookRunnerService;
let browserService: BrowserService;
let aiSelectorService: AISelectorService;
const autoUpdateService = getAutoUpdateService();
const errorHandler = getErrorHandler();

function createWindow() {
  const isDev = !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      sandbox: true,
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: true,
    show: true,
  });

  console.log('[Main] isDev:', isDev);

  // Initialize services
  playbookService = new PlaybookService();
  recordingService = new RecordingService();
  supabaseService = new SupabaseService();
  browserService = new BrowserService();
  runnerService = new PlaybookRunnerService(browserService);
  aiSelectorService = new AISelectorService();
  autoUpdateService.setMainWindow(mainWindow);
  errorHandler.setMainWindow(mainWindow);

  // Connect recording service to shared browser
  recordingService.setBrowserService(browserService);

  // Setup IPC handlers
  setupIpcHandlers();

  // Forward recording events to renderer
  recordingService.onEvent((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('recording:event', event);
    }
  });

  // Forward runner events to renderer
  runnerService.onEvent((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('runner:event', event);
    }
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', async () => {
    mainWindow?.show();

    // Auto-connect to Supabase using env variables
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      console.log('[Main] Auto-connecting to Supabase...');
      const configResult = await supabaseService.configure(supabaseUrl, supabaseKey);
      if (configResult.success) {
        console.log('[Main] Supabase connected successfully');
        // Notify renderer about connection status
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('supabase:connected', {
            connected: true,
            configured: true,
          });
        }
      } else {
        console.error('[Main] Supabase connection failed:', configResult.message);
      }
    } else {
      console.warn('[Main] Supabase credentials not found in env');
    }

    // Auto-launch browser and navigate to login page
    console.log('[Main] Auto-initializing browser...');
    const initResult = await browserService.initialize();
    if (initResult.success) {
      console.log('[Main] Browser initialized, login page loaded');
    } else {
      console.error('[Main] Browser initialization failed:', initResult.error);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupIpcHandlers() {
  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());

  // Playbook CRUD
  ipcMain.handle('playbook:list', async () => {
    return await playbookService.listPlaybooks();
  });

  ipcMain.handle('playbook:load', async (_event, id: string) => {
    return await playbookService.loadPlaybook(id);
  });

  ipcMain.handle('playbook:save', async (_event, playbook) => {
    return await playbookService.savePlaybook(playbook);
  });

  ipcMain.handle('playbook:delete', async (_event, id: string) => {
    return await playbookService.deletePlaybook(id);
  });

  ipcMain.handle('playbook:export', async (_event, id: string, targetPath: string) => {
    return await playbookService.exportPlaybook(id, targetPath);
  });

  ipcMain.handle('playbook:import', async (_event, sourcePath: string) => {
    return await playbookService.importPlaybook(sourcePath);
  });

  // Recording
  ipcMain.handle('recording:start', async (_event, targetUrl?: string) => {
    return await recordingService.startRecording(targetUrl);
  });

  ipcMain.handle('recording:stop', async () => {
    return await recordingService.stopRecording();
  });

  ipcMain.handle('recording:pause', () => {
    recordingService.pauseRecording();
    return { success: true };
  });

  ipcMain.handle('recording:resume', () => {
    recordingService.resumeRecording();
    return { success: true };
  });

  ipcMain.handle('recording:getState', () => {
    return {
      success: true,
      state: recordingService.getState(),
    };
  });

  ipcMain.handle('recording:getSteps', () => {
    return {
      success: true,
      steps: recordingService.getRecordedSteps(),
    };
  });

  ipcMain.handle('recording:clear', () => {
    recordingService.clearRecording();
    return { success: true };
  });

  ipcMain.handle('recording:deleteStep', (_event, index: number) => {
    recordingService.deleteStep(index);
    return { success: true };
  });

  ipcMain.handle('recording:generatePlaybook', (_event, metadata) => {
    return recordingService.generatePlaybook(metadata);
  });

  // Supabase sync
  ipcMain.handle('supabase:configure', async (_event, url: string, key: string) => {
    return await supabaseService.configure(url, key);
  });

  ipcMain.handle('supabase:getStatus', () => {
    return {
      success: true,
      status: supabaseService.getStatus(),
      configured: supabaseService.isConfigured(),
      connected: supabaseService.isConnected(),
    };
  });

  ipcMain.handle('supabase:upload', async (_event, playbookId: string) => {
    const result = await playbookService.loadPlaybook(playbookId);
    if (!result.success || !result.data) {
      return { success: false, message: '플레이북을 찾을 수 없습니다' };
    }
    return await supabaseService.uploadPlaybook(result.data);
  });

  ipcMain.handle('supabase:uploadAll', async () => {
    const listResult = await playbookService.listPlaybooks();
    if (!listResult.success || !listResult.data) {
      return { success: false, message: '플레이북 목록을 가져올 수 없습니다' };
    }

    const playbooks = [];
    for (const meta of listResult.data) {
      const result = await playbookService.loadPlaybook(meta.id);
      if (result.success && result.data) {
        playbooks.push(result.data);
      }
    }

    return await supabaseService.uploadAllPlaybooks(playbooks);
  });

  ipcMain.handle('supabase:listRemote', async () => {
    return await supabaseService.listRemotePlaybooks();
  });

  ipcMain.handle('supabase:download', async (_event, id: string) => {
    const result = await supabaseService.downloadPlaybook(id);
    if (result.success && result.playbook) {
      // 로컬에 저장
      await playbookService.savePlaybook(result.playbook);
    }
    return result;
  });

  ipcMain.handle('supabase:deleteRemote', async (_event, id: string) => {
    return await supabaseService.deleteRemotePlaybook(id);
  });

  // [Remote Repair] 이슈 관리
  ipcMain.handle('botame:get-issues', async (_event, status: string) => {
    return await supabaseService.getFailureReports(status);
  });

  ipcMain.handle('botame:update-issue-status', async (_event, id: string, status: string, resolution?: any) => {
    return await supabaseService.updateIssueStatus(id, status, resolution);
  });

  // [Phase 4] AI Analysis & Fix
  ipcMain.handle('botame:analyze-issue', async (_event, issue) => {
    return await aiSelectorService.repairIssue(issue);
  });

  ipcMain.handle('botame:apply-fix', async (_event, playbookId: string, stepIndex: number, newSelector: string) => {
    return await playbookService.patchStepSelector(playbookId, stepIndex, newSelector);
  });


  // Catalog - DB에서 전체 플레이북 목록 조회 (관리자용)
  ipcMain.handle('supabase:getCatalog', async () => {
    return await supabaseService.getPlaybookCatalog();
  });

  // 플레이북 상세 조회 (DB에서)
  ipcMain.handle('supabase:getPlaybook', async (_event, playbookId: string) => {
    return await supabaseService.getPlaybookDetail(playbookId);
  });

  // 플레이북 업데이트 (DB에 저장)
  ipcMain.handle('supabase:updatePlaybook', async (_event, playbook: Playbook) => {
    return await supabaseService.updatePlaybook(playbook);
  });

  // 브라우저 하이라이트 (단계별 미리보기용)
  ipcMain.handle('browser:highlight', async (_event, selector: string) => {
    return await browserService.highlightElement(selector);
  });

  ipcMain.handle('browser:clearHighlight', async () => {
    return await browserService.clearHighlight();
  });

  // Playbook Runner - from local files
  ipcMain.handle('runner:run', async (_event, playbookId: string, startUrl?: string) => {
    const result = await playbookService.loadPlaybook(playbookId);
    if (!result.success || !result.data) {
      return { success: false, error: '플레이북을 찾을 수 없습니다' };
    }
    return await runnerService.runPlaybook(result.data, startUrl);
  });

  // Playbook Runner - from Supabase catalog (DB)
  ipcMain.handle('runner:runFromCatalog', async (_event, playbookId: string, overrideStartUrl?: string) => {
    const result = await supabaseService.getPlaybookDetail(playbookId);
    if (!result.success || !result.playbook) {
      return { success: false, error: result.message || '플레이북을 찾을 수 없습니다' };
    }
    // 사용자가 직접 지정한 URL이 있으면 사용, 없으면 DB의 start_url 사용
    const startUrl = overrideStartUrl || result.startUrl;
    return await runnerService.runPlaybook(result.playbook, startUrl);
  });

  ipcMain.handle('runner:pause', () => {
    runnerService.pause();
    return { success: true };
  });

  ipcMain.handle('runner:resume', () => {
    runnerService.resume();
    return { success: true };
  });

  ipcMain.handle('runner:stop', () => {
    runnerService.stop();
    return { success: true };
  });

  ipcMain.handle('runner:closeBrowser', async () => {
    await runnerService.navigateToMain();
    return { success: true };
  });

  ipcMain.handle('runner:getState', () => {
    return {
      success: true,
      state: runnerService.getState(),
    };
  });

  // 단일 스텝 실행 (스텝별 테스트용)
  ipcMain.handle('runner:runStep', async (_event, step, stepIndex: number) => {
    return await runnerService.runSingleStep(step, stepIndex);
  });

  // 요소 피킹 모드 시작 (셀렉터 수정용)
  ipcMain.handle('runner:pickElement', async () => {
    return await runnerService.startPickingMode();
  });

  // 요소 피킹 모드 취소
  ipcMain.handle('runner:cancelPicking', async () => {
    await runnerService.cancelPickingMode();
    return { success: true };
  });

  // === Config (프로필 관리) ===

  // 현재 활성 프로필 조회
  ipcMain.handle('config:getProfile', () => {
    return configLoader.getActiveProfile();
  });

  // 프로필 변경
  ipcMain.handle('config:setProfile', (_event, profileId: string) => {
    const success = configLoader.setActiveProfile(profileId);
    return { success, profileId };
  });

  // 모든 프로필 목록
  ipcMain.handle('config:listProfiles', () => {
    return configLoader.listProfiles();
  });

  // 기본 URL 조회
  ipcMain.handle('config:getUrl', (_event, key: 'home' | 'login') => {
    return configLoader.getUrl(key);
  });

  // 카테고리 목록 조회
  ipcMain.handle('config:getCategories', () => {
    return configLoader.getCategories();
  });
}


  // Auto-updater
  ipcMain.handle('autoupdate:check', async () => {
    return await autoUpdateService.checkForUpdates();
  });

  ipcMain.handle('autoupdate:download', async () => {
    return await autoUpdateService.downloadUpdate();
  });

  ipcMain.handle('autoupdate:install', () => {
    autoUpdateService.installAndRestart();
    return { success: true };
  });

  ipcMain.handle('autoupdate:getInfo', () => {
    return {
      success: true,
      updateAvailable: autoUpdateService.isUpdateAvailable(),
      updateDownloaded: autoUpdateService.isUpdateDownloaded(),
      updateInfo: autoUpdateService.getUpdateInfo(),
    };
  });


  // Credentials - API Key Management
  const credentialsService = getCredentialsService();

  ipcMain.handle('credentials:set', async (_event: IpcMainInvokeEvent, service: string, key: string) => {
    return await credentialsService.setApiKey(service as any, key);
  });

  ipcMain.handle('credentials:get', async (_event: IpcMainInvokeEvent, service: string) => {
    const key = await credentialsService.getApiKey(service as any);
    return {
      success: key !== null,
      key,
    };
  });

  ipcMain.handle('credentials:delete', async (_event: IpcMainInvokeEvent, service: string) => {
    return await credentialsService.deleteApiKey(service as any);
  });

  ipcMain.handle('credentials:has', async (_event: IpcMainInvokeEvent, service: string) => {
    const hasKey = await credentialsService.hasApiKey(service as any);
    return {
      success: true,
      hasKey,
    };
  });

  ipcMain.handle('credentials:validate', async (_event: IpcMainInvokeEvent, service: string, key: string) => {
    const result = credentialsService.validateApiKeyFormat(service as any, key);
    return result;
  });

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  recordingService?.cleanup();
  await browserService?.cleanup();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Global error handlers
process.on('uncaughtException', async (error) => {
  console.error('[Main] Uncaught exception:', error);
  await errorHandler.handle(error);
  
  // If fatal error, exit app
  if (error instanceof FatalError) {
    app.exit(1);
  }
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('[Main] Unhandled rejection at:', promise, 'reason:', reason);
  const error = reason instanceof Error ? reason : new Error(String(reason));
  await errorHandler.handle(error);
});
