import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ---- DB <-> App transforms ----

const fromDbEvent = (r) => ({ id: r.id, date: r.event_date, title: r.title, time: r.time || "", person: r.person });
const toDbEvent = (e, hid) => ({ household_id: hid, event_date: e.date, title: e.title, time: e.time || null, person: e.person });

const fromDbDinner = (r) => ({ name: r.name || "", ingredients: r.notes || "" });

const fromDbGrocery = (r) => ({ id: r.id, name: r.name, cat: r.category, checked: r.checked });
const toDbGrocery = (g, hid) => ({ household_id: hid, name: g.name, category: g.cat, checked: g.checked });

const fromDbTodo = (r) => ({ id: r.id, text: r.text, done: r.done });
const toDbTodo = (t, list, hid) => ({ household_id: hid, list, text: t.text, done: t.done });

const fromDbChore = (r) => ({ id: r.id, name: r.name, frequency: r.frequency, assignedTo: r.assigned_to, lastDone: r.last_done });
const toDbChore = (c, hid) => ({ household_id: hid, name: c.name, frequency: c.frequency, assigned_to: c.assignedTo, last_done: c.lastDone || null });

const fromDbTrip = (r) => ({ id: r.id, name: r.name || "", destination: r.destination || "", start: r.start_date || "", end: r.end_date || "", checklist: [] });
const toDbTrip = (t, hid) => ({ household_id: hid, name: t.name, destination: t.destination, start_date: t.start || null, end_date: t.end || null });

const fromDbTripItem = (r) => ({ id: r.id, text: r.text, done: r.done, owner: r.owner || "p1", kind: r.kind || "todo" });
const toDbTripItem = (i, tripId, hid) => ({ trip_id: tripId, household_id: hid, text: i.text, done: i.done, owner: i.owner || "p1", kind: i.kind || "todo" });

const fromDbIdea = (r) => ({ id: r.id, text: r.text });
const toDbIdea = (i, hid) => ({ household_id: hid, text: i.text });

const fromDbPlace = (r) => ({ id: r.id, name: r.name, kind: r.kind });
const toDbPlace = (p, hid) => ({ household_id: hid, kind: p.kind, name: p.name });

const fromDbMeal = (r) => ({ id: r.id, name: r.name });
const toDbMeal = (m, hid) => ({ household_id: hid, name: m.name });

const fromDbNote = (r) => ({ id: r.id, text: r.body || "", at: new Date(r.created_at).getTime(), att: [] });

const fromDbKeyDate = (r) => ({ id: r.id, label: r.label, md: `${String(r.month).padStart(2, "0")}-${String(r.day).padStart(2, "0")}` });
const toDbKeyDate = (d, hid) => {
  const [m, day] = d.md.split("-").map(Number);
  return { household_id: hid, label: d.label, month: m, day };
};

const fromDbSettings = (r) => ({ name1: r.name1 || "Tony", name2: r.name2 || "Alex", home: r.home_name || "Our Home", color1: r.color1 || "indigo", color2: r.color2 || "rose", colorBoth: r.color_both || "emerald" });

// ---- Generic row-level sync ----
// onNewId(localId, dbId) — called after each insert so callers can swap the
// temp client id for the real Postgres UUID in local state.

async function syncRows(table, oldRows, newRows, toDb, onNewId) {
  const oldMap = new Map(oldRows.map((r) => [r.id, r]));
  const newMap = new Map(newRows.map((r) => [r.id, r]));

  const deletes = [...oldMap.keys()].filter((id) => !newMap.has(id));
  if (deletes.length) {
    for (const id of deletes) await supabase.from(table).delete().eq("id", id);
  }

  for (const [id, row] of newMap) {
    if (!oldMap.has(id)) {
      const { data } = await supabase.from(table).insert(toDb(row)).select("id").single();
      if (data?.id && onNewId) onNewId(id, data.id);
    } else if (JSON.stringify(oldMap.get(id)) !== JSON.stringify(row)) {
      await supabase.from(table).update(toDb(row)).eq("id", id);
    }
  }
}

// ---- Attachment helpers ----
// Storage path needs a known id before upload, so we generate a real UUID
// here rather than receiving a client-generated short id from the caller.

async function uploadAttachment(file, compressedBlob, householdId, parentType, parentId) {
  const attId = crypto.randomUUID();
  const path = `${householdId}/${attId}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: upErr } = await supabase.storage.from("attachments").upload(path, compressedBlob, { contentType: file.type });
  if (upErr) throw new Error(upErr.message);

  const { error: rowErr } = await supabase.from("attachments").insert({
    id: attId,
    household_id: householdId,
    parent_type: parentType,
    parent_id: parentId || null,
    name: file.name,
    mime: file.type || "application/octet-stream",
    storage_path: path,
  });
  if (rowErr) throw new Error(rowErr.message);

  const { data: { signedUrl } } = await supabase.storage.from("attachments").createSignedUrl(path, 86400);
  return { id: attId, name: file.name, mime: file.type, storage_path: path, url: signedUrl };
}

async function getSignedUrl(storage_path) {
  const { data } = await supabase.storage.from("attachments").createSignedUrl(storage_path, 86400);
  return data?.signedUrl || "";
}

async function loadAttachments(household_id) {
  const { data } = await supabase.from("attachments").select("*").eq("household_id", household_id);
  if (!data) return [];
  return await Promise.all(
    data.map(async (r) => ({ ...r, url: await getSignedUrl(r.storage_path) }))
  );
}

// ---- Main hook ----

export function useAppData(householdId) {
  const [events, setEvents] = useState([]);
  const [dinners, setDinners] = useState({});
  const [grocery, setGrocery] = useState([]);
  const [todos, setTodos] = useState({ shared: [], p1: [], p2: [] });
  const [notes, setNotes] = useState([]);
  const [chores, setChores] = useState([]);
  const [trips, setTrips] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [visited, setVisited] = useState({ countries: [], states: [] });
  const [meals, setMeals] = useState([]);
  const [important, setImportant] = useState("");
  const [importantFiles, setImportantFiles] = useState([]);
  const [dates, setDates] = useState([]);
  const [settings, setSettings] = useState({ name1: "Tony", name2: "Alex", home: "Our Home", color1: "indigo", color2: "rose", colorBoth: "emerald" });
  const [dataLoading, setDataLoading] = useState(true);

  // ---- Load all data ----
  useEffect(() => {
    if (!householdId) return;

    async function loadAll() {
      setDataLoading(true);

      const [
        evRes, dinRes, grRes, todoRes, noteRes, choreRes, tripRes, itemsRes,
        ideaRes, placeRes, mealRes, hhRes, dateRes,
      ] = await Promise.all([
        supabase.from("events").select("*").eq("household_id", householdId),
        supabase.from("dinners").select("*").eq("household_id", householdId),
        supabase.from("grocery_items").select("*").eq("household_id", householdId),
        supabase.from("todos").select("*").eq("household_id", householdId),
        supabase.from("notes").select("*").eq("household_id", householdId).order("created_at", { ascending: false }),
        supabase.from("chores").select("*").eq("household_id", householdId),
        supabase.from("trips").select("*").eq("household_id", householdId),
        supabase.from("trip_items").select("*").eq("household_id", householdId),
        supabase.from("trip_ideas").select("*").eq("household_id", householdId),
        supabase.from("visited_places").select("*").eq("household_id", householdId),
        supabase.from("favorite_meals").select("*").eq("household_id", householdId),
        supabase.from("households").select("*").eq("id", householdId).single(),
        supabase.from("key_dates").select("*").eq("household_id", householdId),
      ]);

      if (evRes.data) setEvents(evRes.data.map(fromDbEvent));

      if (dinRes.data) {
        const obj = {};
        dinRes.data.forEach((r) => { obj[WEEKDAYS[r.weekday]] = fromDbDinner(r); });
        setDinners(obj);
      }

      if (grRes.data) setGrocery(grRes.data.map(fromDbGrocery));

      if (todoRes.data) {
        setTodos({
          shared: todoRes.data.filter((r) => r.list === "shared").map(fromDbTodo),
          p1: todoRes.data.filter((r) => r.list === "p1").map(fromDbTodo),
          p2: todoRes.data.filter((r) => r.list === "p2").map(fromDbTodo),
        });
      }

      if (noteRes.data) {
        const baseNotes = noteRes.data.map(fromDbNote);
        // Load attachments for notes
        const atts = await loadAttachments(householdId);
        setNotes(baseNotes.map((n) => ({
          ...n,
          att: atts.filter((a) => a.parent_type === "note" && a.parent_id === n.id),
        })));
        setImportantFiles(atts.filter((a) => a.parent_type === "important"));
      }

      if (choreRes.data) setChores(choreRes.data.map(fromDbChore));

      if (tripRes.data && itemsRes.data) {
        const tripsWithItems = tripRes.data.map((t) => ({
          ...fromDbTrip(t),
          checklist: itemsRes.data.filter((i) => i.trip_id === t.id).map(fromDbTripItem),
        }));
        setTrips(tripsWithItems);
      }

      if (ideaRes.data) setIdeas(ideaRes.data.map(fromDbIdea));

      if (placeRes.data) {
        setVisited({
          countries: placeRes.data.filter((r) => r.kind === "country").map(fromDbPlace),
          states: placeRes.data.filter((r) => r.kind === "state").map(fromDbPlace),
        });
      }

      if (mealRes.data) setMeals(mealRes.data.map(fromDbMeal));

      if (hhRes.data) {
        setSettings(fromDbSettings(hhRes.data));
        setImportant(hhRes.data.important_text || "");
      }

      if (dateRes.data) setDates(dateRes.data.map(fromDbKeyDate));

      setDataLoading(false);
    }

    loadAll();
  }, [householdId]);

  // ---- Realtime subscriptions ----
  useEffect(() => {
    if (!householdId) return;

    const channels = [];
    const sub = (name, table, filter, handler) => {
      const ch = supabase
        .channel(name)
        .on("postgres_changes", { event: "*", schema: "public", table, filter }, handler)
        .subscribe();
      channels.push(ch);
    };

    sub(`rt-events-${householdId}`, "events", `household_id=eq.${householdId}`, ({ eventType, new: n, old: o }) => {
      setEvents((cur) => {
        if (eventType === "INSERT") {
          if (cur.some((r) => r.id === n.id)) return cur;
          return [...cur, fromDbEvent(n)];
        }
        if (eventType === "UPDATE") return cur.map((r) => r.id === n.id ? fromDbEvent(n) : r);
        if (eventType === "DELETE") return cur.filter((r) => r.id !== o.id);
        return cur;
      });
    });

    sub(`rt-dinners-${householdId}`, "dinners", `household_id=eq.${householdId}`, ({ eventType, new: n, old: o }) => {
      setDinners((cur) => {
        const day = WEEKDAYS[eventType === "DELETE" ? o.weekday : n.weekday];
        if (!day) return cur;
        if (eventType === "DELETE") { const c = { ...cur }; delete c[day]; return c; }
        return { ...cur, [day]: fromDbDinner(n) };
      });
    });

    sub(`rt-grocery-${householdId}`, "grocery_items", `household_id=eq.${householdId}`, ({ eventType, new: n, old: o }) => {
      setGrocery((cur) => {
        if (eventType === "INSERT") { if (cur.some((r) => r.id === n.id)) return cur; return [...cur, fromDbGrocery(n)]; }
        if (eventType === "UPDATE") return cur.map((r) => r.id === n.id ? fromDbGrocery(n) : r);
        if (eventType === "DELETE") return cur.filter((r) => r.id !== o.id);
        return cur;
      });
    });

    sub(`rt-todos-${householdId}`, "todos", `household_id=eq.${householdId}`, ({ eventType, new: n, old: o }) => {
      setTodos((cur) => {
        const list = eventType === "DELETE" ? o.list : n.list;
        if (!list) return cur;
        if (eventType === "INSERT") {
          if ((cur[list] || []).some((r) => r.id === n.id)) return cur;
          return { ...cur, [list]: [...(cur[list] || []), fromDbTodo(n)] };
        }
        if (eventType === "UPDATE") return { ...cur, [list]: (cur[list] || []).map((r) => r.id === n.id ? fromDbTodo(n) : r) };
        if (eventType === "DELETE") return { ...cur, [list]: (cur[list] || []).filter((r) => r.id !== o.id) };
        return cur;
      });
    });

    sub(`rt-notes-${householdId}`, "notes", `household_id=eq.${householdId}`, ({ eventType, new: n, old: o }) => {
      setNotes((cur) => {
        if (eventType === "INSERT") {
          if (cur.some((r) => r.id === n.id)) return cur;
          return [fromDbNote(n), ...cur];
        }
        if (eventType === "DELETE") return cur.filter((r) => r.id !== o.id);
        return cur;
      });
    });

    sub(`rt-chores-${householdId}`, "chores", `household_id=eq.${householdId}`, ({ eventType, new: n, old: o }) => {
      setChores((cur) => {
        if (eventType === "INSERT") { if (cur.some((r) => r.id === n.id)) return cur; return [...cur, fromDbChore(n)]; }
        if (eventType === "UPDATE") return cur.map((r) => r.id === n.id ? fromDbChore(n) : r);
        if (eventType === "DELETE") return cur.filter((r) => r.id !== o.id);
        return cur;
      });
    });

    sub(`rt-trips-${householdId}`, "trips", `household_id=eq.${householdId}`, ({ eventType, new: n, old: o }) => {
      setTrips((cur) => {
        if (eventType === "INSERT") { if (cur.some((r) => r.id === n.id)) return cur; return [...cur, fromDbTrip(n)]; }
        if (eventType === "UPDATE") return cur.map((r) => r.id === n.id ? { ...r, ...fromDbTrip(n), checklist: r.checklist } : r);
        if (eventType === "DELETE") return cur.filter((r) => r.id !== o.id);
        return cur;
      });
    });

    sub(`rt-trip-items-${householdId}`, "trip_items", `household_id=eq.${householdId}`, ({ eventType, new: n, old: o }) => {
      setTrips((cur) => cur.map((t) => {
        if (eventType === "INSERT" && t.id === n.trip_id) {
          if ((t.checklist || []).some((i) => i.id === n.id)) return t;
          return { ...t, checklist: [...(t.checklist || []), fromDbTripItem(n)] };
        }
        if (eventType === "UPDATE" && t.id === n.trip_id) {
          return { ...t, checklist: (t.checklist || []).map((i) => i.id === n.id ? fromDbTripItem(n) : i) };
        }
        if (eventType === "DELETE") {
          return { ...t, checklist: (t.checklist || []).filter((i) => i.id !== o.id) };
        }
        return t;
      }));
    });

    sub(`rt-ideas-${householdId}`, "trip_ideas", `household_id=eq.${householdId}`, ({ eventType, new: n, old: o }) => {
      setIdeas((cur) => {
        if (eventType === "INSERT") { if (cur.some((r) => r.id === n.id)) return cur; return [fromDbIdea(n), ...cur]; }
        if (eventType === "DELETE") return cur.filter((r) => r.id !== o.id);
        return cur;
      });
    });

    sub(`rt-visited-${householdId}`, "visited_places", `household_id=eq.${householdId}`, ({ eventType, new: n, old: o }) => {
      setVisited((cur) => {
        const kind = eventType === "DELETE" ? o.kind : n.kind;
        const key = kind === "country" ? "countries" : "states";
        if (eventType === "INSERT") { if ((cur[key] || []).some((r) => r.id === n.id)) return cur; return { ...cur, [key]: [...(cur[key] || []), fromDbPlace(n)] }; }
        if (eventType === "DELETE") return { ...cur, [key]: (cur[key] || []).filter((r) => r.id !== o.id) };
        return cur;
      });
    });

    sub(`rt-meals-${householdId}`, "favorite_meals", `household_id=eq.${householdId}`, ({ eventType, new: n, old: o }) => {
      setMeals((cur) => {
        if (eventType === "INSERT") { if (cur.some((r) => r.id === n.id)) return cur; return [...cur, fromDbMeal(n)]; }
        if (eventType === "DELETE") return cur.filter((r) => r.id !== o.id);
        return cur;
      });
    });

    sub(`rt-keydates-${householdId}`, "key_dates", `household_id=eq.${householdId}`, ({ eventType, new: n, old: o }) => {
      setDates((cur) => {
        if (eventType === "INSERT") { if (cur.some((r) => r.id === n.id)) return cur; return [...cur, fromDbKeyDate(n)]; }
        if (eventType === "DELETE") return cur.filter((r) => r.id !== o.id);
        return cur;
      });
    });

    sub(`rt-households-${householdId}`, "households", `id=eq.${householdId}`, ({ eventType, new: n }) => {
      if (eventType === "UPDATE") {
        setSettings(fromDbSettings(n));
        setImportant(n.important_text || "");
      }
    });

    return () => { channels.forEach((ch) => supabase.removeChannel(ch)); };
  }, [householdId]);

  // ---- upX functions ----

  const upEvents = useCallback(async (newEvents) => {
    const cur = events;
    setEvents(newEvents);
    await syncRows("events", cur, newEvents, (e) => toDbEvent(e, householdId), (localId, dbId) => {
      setEvents((prev) => prev.map((e) => e.id === localId ? { ...e, id: dbId } : e));
    });
  }, [events, householdId]);

  const upDinners = useCallback(async (newDinners) => {
    const cur = dinners;
    setDinners(newDinners);
    for (let weekday = 0; weekday < 7; weekday++) {
      const day = WEEKDAYS[weekday];
      const oldVal = cur[day];
      const newVal = newDinners[day];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        if (newVal?.name) {
          await supabase.from("dinners").upsert(
            { household_id: householdId, weekday, name: newVal.name, notes: newVal.ingredients || null },
            { onConflict: "household_id,weekday" }
          );
        } else if (oldVal?.name) {
          await supabase.from("dinners").delete().eq("household_id", householdId).eq("weekday", weekday);
        }
      }
    }
  }, [dinners, householdId]);

  const upGrocery = useCallback(async (newGrocery) => {
    const cur = grocery;
    setGrocery(newGrocery);
    await syncRows("grocery_items", cur, newGrocery, (g) => toDbGrocery(g, householdId), (localId, dbId) => {
      setGrocery((prev) => prev.map((g) => g.id === localId ? { ...g, id: dbId } : g));
    });
  }, [grocery, householdId]);

  const upTodos = useCallback(async (newTodos) => {
    const cur = todos;
    setTodos(newTodos);
    const flatOld = [
      ...(cur.shared || []).map((t) => ({ ...t, list: "shared" })),
      ...(cur.p1 || []).map((t) => ({ ...t, list: "p1" })),
      ...(cur.p2 || []).map((t) => ({ ...t, list: "p2" })),
    ];
    const flatNew = [
      ...(newTodos.shared || []).map((t) => ({ ...t, list: "shared" })),
      ...(newTodos.p1 || []).map((t) => ({ ...t, list: "p1" })),
      ...(newTodos.p2 || []).map((t) => ({ ...t, list: "p2" })),
    ];
    await syncRows("todos", flatOld, flatNew, (t) => toDbTodo(t, t.list, householdId), (localId, dbId) => {
      setTodos((prev) => {
        const remap = (arr) => arr.map((t) => t.id === localId ? { ...t, id: dbId } : t);
        return { shared: remap(prev.shared), p1: remap(prev.p1), p2: remap(prev.p2) };
      });
    });
  }, [todos, householdId]);

  const upNotes = useCallback(async (newNotes) => {
    const cur = notes;
    setNotes(newNotes);
    const oldIds = new Set(cur.map((n) => n.id));
    const newIds = new Set(newNotes.map((n) => n.id));
    for (const n of cur) {
      if (!newIds.has(n.id)) await supabase.from("notes").delete().eq("id", n.id);
    }
    for (const n of newNotes) {
      if (!oldIds.has(n.id)) {
        const { data } = await supabase.from("notes").insert({ household_id: householdId, body: n.text }).select("id").single();
        if (data?.id) {
          setNotes((prev) => prev.map((note) => note.id === n.id ? { ...note, id: data.id } : note));
        }
      }
    }
  }, [notes, householdId]);

  const upChores = useCallback(async (newChores) => {
    const cur = chores;
    setChores(newChores);
    await syncRows("chores", cur, newChores, (c) => toDbChore(c, householdId), (localId, dbId) => {
      setChores((prev) => prev.map((c) => c.id === localId ? { ...c, id: dbId } : c));
    });
  }, [chores, householdId]);

  const upTrips = useCallback(async (newTrips) => {
    const cur = trips;
    setTrips(newTrips);

    const oldMap = new Map(cur.map((t) => [t.id, t]));
    const newMap = new Map(newTrips.map((t) => [t.id, t]));

    for (const [id] of oldMap) {
      if (!newMap.has(id)) await supabase.from("trips").delete().eq("id", id);
    }

    for (const [id, trip] of newMap) {
      if (!oldMap.has(id)) {
        const { data: tripData } = await supabase.from("trips").insert(toDbTrip(trip, householdId)).select("id").single();
        if (tripData?.id) {
          const dbTripId = tripData.id;
          setTrips((prev) => prev.map((t) => t.id === id ? { ...t, id: dbTripId } : t));
          if (trip.checklist?.length) {
            for (const item of trip.checklist) {
              const { data: itemData } = await supabase.from("trip_items").insert(toDbTripItem(item, dbTripId, householdId)).select("id").single();
              if (itemData?.id) {
                setTrips((prev) => prev.map((t) => t.id === dbTripId
                  ? { ...t, checklist: (t.checklist || []).map((ci) => ci.id === item.id ? { ...ci, id: itemData.id } : ci) }
                  : t));
              }
            }
          }
        }
      } else {
        const old = oldMap.get(id);
        const tripMeta = (t) => ({ name: t.name, destination: t.destination, start: t.start, end: t.end });
        if (JSON.stringify(tripMeta(old)) !== JSON.stringify(tripMeta(trip))) {
          await supabase.from("trips").update(toDbTrip(trip, householdId)).eq("id", id);
        }
        await syncRows("trip_items", old.checklist || [], trip.checklist || [], (i) => toDbTripItem(i, id, householdId), (localId, dbId) => {
          setTrips((prev) => prev.map((t) => t.id === id
            ? { ...t, checklist: (t.checklist || []).map((ci) => ci.id === localId ? { ...ci, id: dbId } : ci) }
            : t));
        });
      }
    }
  }, [trips, householdId]);

  const upIdeas = useCallback(async (newIdeas) => {
    const cur = ideas;
    setIdeas(newIdeas);
    await syncRows("trip_ideas", cur, newIdeas, (i) => toDbIdea(i, householdId), (localId, dbId) => {
      setIdeas((prev) => prev.map((i) => i.id === localId ? { ...i, id: dbId } : i));
    });
  }, [ideas, householdId]);

  const upVisited = useCallback(async (newVisited) => {
    const cur = visited;
    setVisited(newVisited);
    const flatOld = [
      ...(cur.countries || []).map((p) => ({ ...p, kind: "country" })),
      ...(cur.states || []).map((p) => ({ ...p, kind: "state" })),
    ];
    const flatNew = [
      ...(newVisited.countries || []).map((p) => ({ ...p, kind: "country" })),
      ...(newVisited.states || []).map((p) => ({ ...p, kind: "state" })),
    ];
    await syncRows("visited_places", flatOld, flatNew, (p) => toDbPlace(p, householdId), (localId, dbId) => {
      setVisited((prev) => ({
        countries: prev.countries.map((p) => p.id === localId ? { ...p, id: dbId } : p),
        states: prev.states.map((p) => p.id === localId ? { ...p, id: dbId } : p),
      }));
    });
  }, [visited, householdId]);

  const upMeals = useCallback(async (newMeals) => {
    const cur = meals;
    setMeals(newMeals);
    await syncRows("favorite_meals", cur, newMeals, (m) => toDbMeal(m, householdId), (localId, dbId) => {
      setMeals((prev) => prev.map((m) => m.id === localId ? { ...m, id: dbId } : m));
    });
  }, [meals, householdId]);

  const upImportant = useCallback(async (text) => {
    setImportant(text);
    await supabase.from("households").update({ important_text: text }).eq("id", householdId);
  }, [householdId]);

  const upImportantFiles = useCallback(async (newFiles) => {
    const cur = importantFiles;
    setImportantFiles(newFiles);
    const newIds = new Set(newFiles.map((f) => f.id));
    for (const f of cur) {
      if (!newIds.has(f.id)) {
        await supabase.storage.from("attachments").remove([f.storage_path]);
        await supabase.from("attachments").delete().eq("id", f.id);
      }
    }
  }, [importantFiles]);

  const upDates = useCallback(async (newDates) => {
    const cur = dates;
    setDates(newDates);
    await syncRows("key_dates", cur, newDates, (d) => toDbKeyDate(d, householdId), (localId, dbId) => {
      setDates((prev) => prev.map((d) => d.id === localId ? { ...d, id: dbId } : d));
    });
  }, [dates, householdId]);

  const upSettings = useCallback(async (newSettings) => {
    setSettings(newSettings);
    await supabase.from("households").update({
      home_name: newSettings.home,
      name1: newSettings.name1,
      name2: newSettings.name2,
      color1: newSettings.color1,
      color2: newSettings.color2,
      color_both: newSettings.colorBoth,
    }).eq("id", householdId);
  }, [householdId]);

  const addAttachment = useCallback(async (file, compressedBlob, _attId, parentType, parentId) => {
    const att = await uploadAttachment(file, compressedBlob, householdId, parentType, parentId);
    if (parentType === "important") {
      setImportantFiles((cur) => [...cur, att]);
    } else if (parentType === "note") {
      setNotes((cur) => cur.map((n) => n.id === parentId ? { ...n, att: [...(n.att || []), att] } : n));
    }
    return att;
  }, [householdId]);

  const removeAttachment = useCallback(async (attId, storagePath) => {
    await supabase.storage.from("attachments").remove([storagePath]);
    await supabase.from("attachments").delete().eq("id", attId);
    setNotes((cur) => cur.map((n) => ({ ...n, att: (n.att || []).filter((a) => a.id !== attId) })));
    setImportantFiles((cur) => cur.filter((a) => a.id !== attId));
  }, []);

  return {
    events, dinners, grocery, todos, notes, chores, trips, ideas,
    visited, meals, important, importantFiles, dates, settings, dataLoading,
    upEvents, upDinners, upGrocery, upTodos, upNotes, upChores, upTrips,
    upIdeas, upVisited, upMeals, upImportant, upImportantFiles, upDates, upSettings,
    addAttachment, removeAttachment,
  };
}
