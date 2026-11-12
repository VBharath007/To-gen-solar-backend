import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserProfile } from '@shared/types/settings.types';

interface UserProfileContextType {
  profile: UserProfile;
  initials: string;
  isLoading: boolean;
  updateProfile: (updated: UserProfile) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
}

const DEFAULT_PROFILE: UserProfile = {
  displayName: 'Administrator',
  email: 'admin@togen.solar',
  phoneNumber: '+91 98765 43210',
};

function computeInitials(name: string): string {
  if (!name || !name.trim()) return 'AD';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const UserProfileContext = createContext<UserProfileContextType>({
  profile: DEFAULT_PROFILE,
  initials: 'AD',
  isLoading: false,
  updateProfile: async () => false,
  refreshProfile: async () => {},
});

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = useCallback(async () => {
    try {
      if (window.desktop?.settings?.getAll) {
        const res = await window.desktop.settings.getAll();
        if (res.success && res.data.profile) {
          setProfile(res.data.profile);
        }
      }
    } catch (err) {
      console.warn('[UserProfileContext] Could not load profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const updateProfile = async (updated: UserProfile): Promise<boolean> => {
    try {
      if (window.desktop?.settings?.updateProfile) {
        const res = await window.desktop.settings.updateProfile(updated);
        if (res.success && res.data) {
          setProfile(res.data);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('[UserProfileContext] Failed to update profile:', err);
      return false;
    }
  };

  const initials = computeInitials(profile.displayName);

  return (
    <UserProfileContext.Provider
      value={{
        profile,
        initials,
        isLoading,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};

export function useUserProfile(): UserProfileContextType {
  return useContext(UserProfileContext);
}
