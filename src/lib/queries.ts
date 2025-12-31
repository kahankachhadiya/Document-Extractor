import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createProfile, fetchProfile, fetchProfiles, updateProfile, deleteProfile } from "@/lib/api";
import { Profile } from "@/types/profile";

export function useProfiles() {
  return useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
}

export function useProfile(id?: string) {
  return useQuery({ queryKey: ["profiles", id], queryFn: () => fetchProfile(id as string), enabled: !!id });
}

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profile: Profile) => createProfile(profile),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

export function useUpdateProfile(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (partial: Partial<Profile>) => updateProfile(id, partial),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["profiles", id] });
    },
  });
}

export function useDeleteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProfile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}


