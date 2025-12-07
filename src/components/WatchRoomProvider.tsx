// WatchRoom 全局状态管理 Provider
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useWatchRoom } from '@/hooks/useWatchRoom';
import type { Room, Member, ChatMessage, WatchRoomConfig } from '@/types/watch-room';
import type { WatchRoomSocket } from '@/lib/watch-room-socket';
import Toast, { ToastProps } from '@/components/Toast';

interface WatchRoomContextType {
  socket: WatchRoomSocket | null;
  isConnected: boolean;
  currentRoom: Room | null;
  members: Member[];
  chatMessages: ChatMessage[];
  isOwner: boolean;
  isEnabled: boolean;
  config: WatchRoomConfig | null;

  // 房间操作
  createRoom: (data: {
    name: string;
    description: string;
    password?: string;
    isPublic: boolean;
    userName: string;
  }) => Promise<Room>;
  joinRoom: (data: {
    roomId: string;
    password?: string;
    userName: string;
  }) => Promise<{ room: Room; members: Member[] }>;
  leaveRoom: () => void;
  getRoomList: () => Promise<Room[]>;

  // 聊天
  sendChatMessage: (content: string, type?: 'text' | 'emoji') => void;

  // 播放控制（供 play/live 页面使用）
  updatePlayState: (state: any) => void;
  seekPlayback: (currentTime: number) => void;
  play: () => void;
  pause: () => void;
  changeVideo: (state: any) => void;
  changeLiveChannel: (state: any) => void;
  clearRoomState: () => void;
}

const WatchRoomContext = createContext<WatchRoomContextType | null>(null);

export const useWatchRoomContext = () => {
  const context = useContext(WatchRoomContext);
  if (!context) {
    throw new Error('useWatchRoomContext must be used within WatchRoomProvider');
  }
  return context;
};

// 安全版本，可以在非 Provider 内使用
export const useWatchRoomContextSafe = () => {
  return useContext(WatchRoomContext);
};

interface WatchRoomProviderProps {
  children: React.ReactNode;
}

export function WatchRoomProvider({ children }: WatchRoomProviderProps) {
  const [config, setConfig] = useState<WatchRoomConfig | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);

  // 处理房间删除的回调
  const handleRoomDeleted = useCallback((data?: { reason?: string }) => {
    console.log('[WatchRoomProvider] Room deleted:', data);

    // 显示Toast提示
    if (data?.reason === 'owner_left') {
      setToast({
        message: '房主已解散房间',
        type: 'error',
        duration: 4000,
        onClose: () => setToast(null),
      });
    } else {
      setToast({
        message: '房间已被删除',
        type: 'info',
        duration: 3000,
        onClose: () => setToast(null),
      });
    }
  }, []);

  // 处理房间状态清除的回调（房主离开超过30秒）
  const handleStateCleared = useCallback(() => {
    console.log('[WatchRoomProvider] Room state cleared');

    setToast({
      message: '房主已离开，播放状态已清除',
      type: 'warning',
      duration: 4000,
      onClose: () => setToast(null),
    });
  }, []);

  const watchRoom = useWatchRoom(handleRoomDeleted, handleStateCleared);

  // 加载配置
  useEffect(() => {
    const loadConfig = async () => {
      // 默认配置：启用内部服务器
      const defaultConfig: WatchRoomConfig = {
        enabled: true,
        serverType: 'internal',
      };

      try {
        const response = await fetch('/api/admin/config');
        if (response.ok) {
          const data = await response.json();
          const watchRoomConfig: WatchRoomConfig = {
            enabled: data.watchRoom?.enabled ?? true,
            serverType: data.watchRoom?.serverType ?? 'internal',
            externalServerUrl: data.watchRoom?.externalServerUrl,
            externalServerAuth: data.watchRoom?.externalServerAuth,
          };
          setConfig(watchRoomConfig);
          setIsEnabled(watchRoomConfig.enabled);

          // 如果启用了观影室，自动连接
          if (watchRoomConfig.enabled) {
            console.log('[WatchRoom] Connecting with config:', watchRoomConfig);
            await watchRoom.connect(watchRoomConfig);
          }
        } else {
          throw new Error('Failed to load config');
        }
      } catch (error) {
        console.log('[WatchRoom] Using default config (internal server enabled)');
        setConfig(defaultConfig);
        setIsEnabled(true);

        try {
          await watchRoom.connect(defaultConfig);
        } catch (connectError) {
          console.error('[WatchRoom] Failed to connect:', connectError);
        }
      }
    };

    loadConfig();

    // 清理
    return () => {
      watchRoom.disconnect();
    };
  }, []);

  const contextValue: WatchRoomContextType = {
    socket: watchRoom.socket,
    isConnected: watchRoom.isConnected,
    currentRoom: watchRoom.currentRoom,
    members: watchRoom.members,
    chatMessages: watchRoom.chatMessages,
    isOwner: watchRoom.isOwner,
    isEnabled,
    config,
    createRoom: watchRoom.createRoom,
    joinRoom: watchRoom.joinRoom,
    leaveRoom: watchRoom.leaveRoom,
    getRoomList: watchRoom.getRoomList,
    sendChatMessage: watchRoom.sendChatMessage,
    updatePlayState: watchRoom.updatePlayState,
    seekPlayback: watchRoom.seekPlayback,
    play: watchRoom.play,
    pause: watchRoom.pause,
    changeVideo: watchRoom.changeVideo,
    changeLiveChannel: watchRoom.changeLiveChannel,
    clearRoomState: watchRoom.clearRoomState,
  };

  return (
    <WatchRoomContext.Provider value={contextValue}>
      {children}
      {toast && <Toast {...toast} />}
    </WatchRoomContext.Provider>
  );
}
