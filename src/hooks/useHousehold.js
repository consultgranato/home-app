import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";

export function useHousehold(userId) {
  const [householdId, setHouseholdId] = useState(null);
  const [slot, setSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const resolve = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("household_members")
      .select("household_id, slot")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      setHouseholdId(data.household_id);
      setSlot(data.slot);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { resolve(); }, [resolve]);

  const createHousehold = async () => {
    setError(null);
    const { data: hh, error: e1 } = await supabase
      .from("households")
      .insert({ home_name: "Our Home", name1: "Tony", name2: "Alex" })
      .select()
      .single();
    if (e1) { setError(e1.message); return; }

    const { error: e2 } = await supabase.from("household_members").insert({
      household_id: hh.id,
      user_id: userId,
      slot: 1,
    });
    if (e2) { setError(e2.message); return; }

    setHouseholdId(hh.id);
    setSlot(1);
  };

  const joinHousehold = async (code) => {
    setError(null);
    const trimmed = code.trim();
    const { data: hh } = await supabase
      .from("households")
      .select("id")
      .eq("id", trimmed)
      .maybeSingle();

    if (!hh) { setError("Household not found. Double-check the invite code."); return; }

    const { error: e } = await supabase.from("household_members").insert({
      household_id: hh.id,
      user_id: userId,
      slot: 2,
    });
    if (e) { setError(e.message); return; }

    setHouseholdId(hh.id);
    setSlot(2);
  };

  return { householdId, slot, loading, error, createHousehold, joinHousehold };
}
