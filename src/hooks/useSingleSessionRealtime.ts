import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

function getOrCreateDeviceId() {
  try {
    const key = "ghq_device_id";
    let id = localStorage.getItem(key);
    if (!id) {
      // Generate a reasonably unique id
      id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Enforce single active guard session using Supabase Realtime.
 *
 * Behaviour:
 * - When a guard opens the dashboard, the hook subscribes to a user channel.
 * - It immediately broadcasts a "force-logout" event with its deviceId and timestamp.
 * - Any other device with an older session receives it and signs out.
 */
export function useSingleSessionRealtime(userId?: string) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const sessionStartTsRef = useRef<number>(Date.now());
  const deviceIdRef = useRef<string>(getOrCreateDeviceId());

  useEffect(() => {
    if (!userId) return;

    const sessionStartTs = sessionStartTsRef.current;
    const deviceId = deviceIdRef.current;

    const channel = supabase
      .channel(`guard-session-${userId}`, { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "force-logout" }, async (payload) => {
        try {
          const { senderDeviceId, ts } = (payload?.payload || {}) as { senderDeviceId?: string; ts?: number };
          // Ignore our own messages
          if (!senderDeviceId || senderDeviceId === deviceId) return;
          // Only sign out if the incoming message corresponds to a newer login
          if (typeof ts === "number" && ts >= sessionStartTs) {
            await supabase.auth.signOut();
            toast({
              variant: "destructive",
              title: "Logged out",
              description: "You were logged out due to a login on another device.",
            });
            navigate("/auth");
          }
        } catch (err) {
          console.error("Single-session realtime handler error", err);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Announce our active session to log out older ones
          channel.send({
            type: "broadcast",
            event: "force-logout",
            payload: { senderDeviceId: deviceId, ts: sessionStartTs },
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, toast, navigate]);
}
