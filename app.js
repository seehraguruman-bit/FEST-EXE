"use strict";

/* 1. DATA: three arrays of objects, linked by numeric IDs.
   A new key keeps the old website's browser data untouched. */
const STORAGE_KEY = "fest-exe-simple-v2";
const EQUIPMENT = ["Microphone", "Drum kit", "Keyboard", "DJ console", "LED screen"];
let scheduleView = "timetable";
let editingPerformanceId = null;
let editingArtistId = null;
let editingStageId = null;
let noticeTimer;
let storageProblem = "";
let data = loadData();

function demoData() {
  return {
    artists: [
      { id: 1, name: "Neon Palms", genre: "Electronic", email: "hello@neonpalms.example", equipment: ["DJ console", "LED screen"] },
      { id: 2, name: "The Paper Moons", genre: "Indie rock", email: "hello@papermoons.example", equipment: ["Microphone", "Drum kit"] },
      { id: 3, name: "Mira Sol", genre: "Pop / Soul", email: "hello@mirasol.example", equipment: ["Microphone", "Keyboard"] },
      { id: 4, name: "Bassline Ritual", genre: "House / Techno", email: "hello@bassline.example", equipment: ["DJ console"] },
      { id: 5, name: "Juniper & The Wild", genre: "Acoustic / Folk", email: "hello@juniper.example", equipment: ["Microphone"] },
      { id: 6, name: "Static Bloom", genre: "Alternative", email: "hello@staticbloom.example", equipment: ["Microphone", "Drum kit", "Keyboard"] }
    ],
    stages: [
      { id: 1, name: "Main Stage", capacity: 5000, equipment: ["Microphone", "Drum kit", "Keyboard", "DJ console", "LED screen"] },
      { id: 2, name: "Acoustic Corner", capacity: 800, equipment: ["Microphone", "Keyboard"] },
      { id: 3, name: "DJ Arena", capacity: 2000, equipment: ["Microphone", "DJ console", "LED screen"] }
    ],
    performances: [
      { id: 1, artistId: 2, stageId: 1, day: 1, start: "17:00", end: "18:00" },
      { id: 2, artistId: 1, stageId: 3, day: 1, start: "19:00", end: "20:00" },
      { id: 3, artistId: 5, stageId: 2, day: 2, start: "16:00", end: "17:00" },
      { id: 4, artistId: 3, stageId: 1, day: 2, start: "18:00", end: "19:00" },
      { id: 5, artistId: 6, stageId: 1, day: 3, start: "17:30", end: "18:30" },
      { id: 6, artistId: 4, stageId: 3, day: 3, start: "20:00", end: "21:00" }
    ]
  };
}

/* 2. SMALL HELPERS */
function element(id) { return document.getElementById(id); }
function nextId(items) {
  let highest = 0;
  for (const item of items) highest = Math.max(highest, item.id);
  return highest + 1;
}
function findArtist(id, source = data) { return source.artists.find(function (artist) { return artist.id === id; }); }
function findStage(id, source = data) { return source.stages.find(function (stage) { return stage.id === id; }); }
function toMinutes(time) {
  const parts = time.split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}
function formatTime(time) {
  const parts = time.split(":");
  const hours = Number(parts[0]);
  const suffix = hours >= 12 ? "PM" : "AM";
  return (hours % 12 || 12) + ":" + parts[1] + " " + suffix;
}
function timeRange(slot) { return formatTime(slot.start) + " – " + formatTime(slot.end); }
function sortedPerformances() {
  return data.performances.slice().sort(function (a, b) {
    return a.day - b.day || toMinutes(a.start) - toMinutes(b.start);
  });
}
// Treat user text as text, never as executable HTML.
function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function showNotice(message) {
  element("notice").textContent = message;
  element("notice").hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(function () { element("notice").hidden = true; }, 6500);
}
function showError(id, message) {
  element(id).textContent = message;
  element(id).hidden = !message;
}
function readEquipment(id) {
  const equipment = [];
  for (const checkbox of element(id).querySelectorAll("input")) {
    if (checkbox.checked) equipment.push(checkbox.value);
  }
  return equipment;
}
function fillEquipment(id, equipment) {
  for (const checkbox of element(id).querySelectorAll("input")) {
    checkbox.checked = equipment.includes(checkbox.value);
  }
}
function normaliseName(name) { return name.trim().replace(/\s+/g, " ").toLowerCase(); }
function duplicateName(items, name, exceptId) {
  return items.some(function (item) {
    return item.id !== exceptId && normaliseName(item.name) === normaliseName(name);
  });
}

/* 3. VALIDATION: the same rules power availability labels and saving. */
function getConflicts(slot, artist, stage, performances) {
  const issues = [];
  if (!artist) issues.push("Choose an artist.");
  if (!stage) issues.push("Choose a stage.");
  if (![1, 2, 3].includes(Number(slot.day))) issues.push("Choose a valid festival day.");
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timePattern.test(slot.start) || !timePattern.test(slot.end)) {
    issues.push("Enter complete start and end times.");
    return issues;
  }
  const start = toMinutes(slot.start);
  const end = toMinutes(slot.end);
  if (end <= start) {
    issues.push("End time must be after start time on the same day.");
    return issues;
  }
  // Report ALL collisions, not just the first equipment or time problem.
  for (const existing of performances) {
    if (existing.id === slot.id || Number(existing.day) !== Number(slot.day)) continue;
    const overlaps = start < toMinutes(existing.end) && end > toMinutes(existing.start);
    if (!overlaps) continue;
    if (artist && Number(existing.artistId) === Number(slot.artistId)) {
      issues.push("Artist conflict: " + (artist.name || "This artist") + " already has a set at " + timeRange(existing) + " on Day " + slot.day + ".");
    }
    if (stage && Number(existing.stageId) === Number(slot.stageId)) {
      issues.push("Stage conflict: " + stage.name + " is booked at " + timeRange(existing) + " on Day " + slot.day + ".");
    }
  }
  if (artist && stage) {
    const missing = artist.equipment.filter(function (item) { return !stage.equipment.includes(item); });
    if (missing.length) issues.push("Equipment conflict: " + stage.name + " is missing " + missing.join(", ") + ".");
  }
  return issues;
}
function checkConflict(slot, artist, stage, performances) {
  return getConflicts(slot, artist, stage, performances).join(" ");
}

function checkFestival(source) {
  for (const slot of source.performances) {
    const issue = checkConflict(slot, findArtist(slot.artistId, source), findStage(slot.stageId, source), source.performances);
    if (issue) return "Day " + slot.day + ": " + issue;
  }
  return "";
}

/* 4. STORAGE: JSON converts arrays/objects to a string and back. */
function validData(source) {
  if (!source || !Array.isArray(source.artists) || !Array.isArray(source.stages) || !Array.isArray(source.performances)) return false;
  for (const list of [source.artists, source.stages, source.performances]) {
    const ids = [];
    for (const item of list) {
      if (!item || !Number.isInteger(item.id) || item.id < 1 || ids.includes(item.id)) return false;
      ids.push(item.id);
    }
  }
  for (const item of source.artists.concat(source.stages)) {
    if (typeof item.name !== "string" || !item.name.trim() || !Array.isArray(item.equipment)) return false;
    if (!item.equipment.every(function (value) { return EQUIPMENT.includes(value); })) return false;
  }
  for (const artist of source.artists) {
    if (typeof artist.genre !== "string" || !artist.genre.trim() || typeof artist.email !== "string") return false;
  }
  for (const stage of source.stages) {
    if (!Number.isInteger(stage.capacity) || stage.capacity < 1) return false;
  }
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const slot of source.performances) {
    if (!timePattern.test(slot.start) || !timePattern.test(slot.end)) return false;
  }
  return !checkFestival(source);
}
function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return demoData();
    const parsed = JSON.parse(saved);
    if (!validData(parsed)) throw new Error("Invalid saved data");
    return parsed;
  } catch (error) {
    storageProblem = "Saved data could not be read. Showing demo data; saving is disabled to protect the original.";
    return demoData();
  }
}
function saveData(nextData) {
  const issue = checkFestival(nextData);
  if (issue) { showNotice("Not saved. " + issue); return false; }
  if (storageProblem) { showNotice(storageProblem); return false; }
  try {
    // Write first: failed storage must not appear to be a successful save.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
    data = nextData;
    renderPage();
    return true;
  } catch (error) {
    showNotice("Could not save. Browser storage is unavailable or full. Your form has been kept.");
    return false;
  }
}

/* 5. DISPLAY: each function fills one part of an existing HTML page. */
function stageFilter(id) {
  const select = element(id);
  const previous = select.value;
  select.innerHTML = '<option value="">All stages</option>';
  for (const stage of data.stages) select.add(new Option(stage.name, stage.id));
  select.value = previous;
  if (!select.value) select.value = "";
}
function actionButtons(kind, id) {
  // IDs are validated integers. Names are set with textContent elsewhere.
  return '<div class="row-actions"><button class="action-button" data-action="edit-' + kind + '" data-id="' + id + '">Edit</button><button class="action-button danger" data-action="delete-' + kind + '" data-id="' + id + '">Delete</button></div>';
}
function renderSchedule() {
  const day = Number(element("day-filter").value);
  const stageId = Number(element("stage-filter").value);
  let rows = "";
  let count = 0;
  for (const slot of sortedPerformances()) {
    if ((day && slot.day !== day) || (stageId && slot.stageId !== stageId)) continue;
    rows += '<tr><td><strong>Day ' + slot.day + '</strong><span class="time-cell">' + timeRange(slot) + '</span></td><td><strong>' + escapeHTML(findArtist(slot.artistId).name) + '</strong><small>' + escapeHTML(findArtist(slot.artistId).genre) + '</small></td><td>' + escapeHTML(findStage(slot.stageId).name) + '</td><td>' + actionButtons("performance", slot.id) + '</td></tr>';
    count++;
  }
  element("schedule-list").innerHTML = rows || '<tr><td colspan="4" class="empty-state">No matching performances. Adjust the filters or add a performance.</td></tr>';
  renderTimetables(day, stageId);
  element("schedule-list-count").textContent = "Showing " + count + " of " + data.performances.length + " performances";
}
function renderArtists() {
  const search = element("artist-search").value.toLowerCase().trim();
  let rows = "";
  for (const artist of data.artists) {
    if (!(artist.name + " " + artist.genre).toLowerCase().includes(search)) continue;
    rows += '<tr><td><strong>' + escapeHTML(artist.name) + '</strong><small>' + escapeHTML(artist.email || "No contact email") + '</small></td><td>' + escapeHTML(artist.genre) + '</td><td>' + escapeHTML(artist.equipment.join(", ") || "None") + '</td><td>' + actionButtons("artist", artist.id) + '</td></tr>';
  }
  element("artist-list").innerHTML = rows || '<tr><td colspan="4" class="empty-state">No artists found. Create new artists with Add performance.</td></tr>';
}
function renderStages() {
  let rows = "";
  for (const stage of data.stages) {
    rows += '<tr><td><strong>' + escapeHTML(stage.name) + '</strong></td><td>' + stage.capacity.toLocaleString() + '</td><td>' + escapeHTML(stage.equipment.join(", ") || "None") + '</td><td>' + actionButtons("stage", stage.id) + '</td></tr>';
  }
  element("stage-list").innerHTML = rows || '<tr><td colspan="4" class="empty-state">No stages yet. Add a stage to start booking performances.</td></tr>';
}
function renderPage() {
  element("performance-count").textContent = data.performances.length;
  element("artist-count").textContent = data.artists.length;
  element("stage-count").textContent = data.stages.length;
  stageFilter("stage-filter");
  renderSchedule();
  renderArtists();
  renderStages();
}


/* TIMETABLE: stages are rows; each minute is two pixels horizontally. */
function timetableRange(day) {
  // Show the full festival day; bookings can still extend the range if needed.
  let start = 0;
  let end = 24 * 60;
  for (const slot of data.performances) {
    if (slot.day !== day) continue;
    start = Math.min(start, Math.floor(toMinutes(slot.start) / 60) * 60);
    end = Math.max(end, Math.ceil(toMinutes(slot.end) / 60) * 60);
  }
  return { start: start, end: end };
}
function minuteLabel(minutes) {
  if (minutes === 1440) return "12:00 AM";
  const hour = Math.floor(minutes / 60);
  return formatTime(String(hour).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0"));
}
function renderTimetables(day, stageId) {
  let html = "";
  for (const selectedDay of (day ? [day] : [1, 2, 3])) {
    if (!day) html += '<h3 class="timeline-day-title">Day ' + selectedDay + '</h3>';
    html += buildTimetable(selectedDay, stageId);
  }
  element("timetable").innerHTML = html;
  changeView(scheduleView);
}
function buildTimetable(day, stageId) {
  const stages = data.stages.filter(function (stage) { return !stageId || stage.id === stageId; });
  if (!stages.length) return '<p class="empty-state">No stages yet. The timetable will appear once a stage is added.</p>';
  const range = timetableRange(day);
  const width = (range.end - range.start) * 2;
  let html = '<div class="timeline-scroll" tabindex="0" role="region" aria-label="Day ' + day + ' timetable. Scroll horizontally to see the full timeline."><div class="timeline-grid">';
  html += '<div class="timeline-row timeline-header"><div class="timeline-label">STAGE / TIME</div><div class="timeline-hours" style="width:' + width + 'px">';
  for (let minute = range.start; minute < range.end; minute += 60) {
    html += '<span class="hour-tick" style="left:' + ((minute - range.start) * 2) + 'px">' + minuteLabel(minute) + '</span>';
  }
  html += '</div></div>';
  let count = 0;
  for (const stage of stages) {
    html += '<div class="timeline-row"><div class="timeline-label"><strong>' + escapeHTML(stage.name) + '</strong><small>' + stage.capacity.toLocaleString() + ' capacity</small></div><div class="timeline-track" style="width:' + width + 'px">';
    for (const slot of sortedPerformances()) {
      if (slot.day !== day || slot.stageId !== stage.id) continue;
      const artist = findArtist(slot.artistId);
      const left = (toMinutes(slot.start) - range.start) * 2;
      const blockWidth = (toMinutes(slot.end) - toMinutes(slot.start)) * 2;
      const description = artist.name + ", Day " + day + ", " + timeRange(slot) + ", " + stage.name;
      const shortClass = blockWidth < 60 ? " short-set" : "";
      html += '<button class="set-block ' + shortClass + '" data-set="' + slot.id + '" style="left:' + left + 'px;width:' + blockWidth + 'px" aria-label="' + escapeHTML(description) + '" title="' + escapeHTML(description) + '"><strong>' + escapeHTML(artist.name) + '</strong><span>' + slot.start + ' - ' + slot.end + '</span><small>' + escapeHTML(artist.genre) + '</small></button>';
      count++;
    }
    html += '</div></div>';
  }
  html += '</div></div>';
  if (!count) html += '<p class="empty-state">No performances for these filters. Choose another day or stage.</p>';
  return html;
}
function changeView(view) {
  scheduleView = view;
  element("timetable-view").hidden = view !== "timetable";
  element("list-view").hidden = view !== "list";
  for (const button of document.querySelectorAll("[data-view]")) {
    button.classList.toggle("active", button.dataset.view === view);
    button.setAttribute("aria-pressed", button.dataset.view === view);
  }
}
function showPanel(name) {
  const headings = {
    performances: ["Schedule", "Plan every performance. Keep every stage in sync."],
    artists: ["Artists", "Manage artist profiles and technical requirements."],
    stages: ["Stages", "Set up the spaces that make your festival happen."]
  };
  element("workspace-title").textContent = headings[name][0];
  element("workspace-description").textContent = headings[name][1];
  for (const panel of document.querySelectorAll(".panel")) panel.hidden = panel.id !== name + "-panel";
  for (const button of document.querySelectorAll("[data-panel]")) {
    button.classList.toggle("active", button.dataset.panel === name);
    button.setAttribute("aria-pressed", button.dataset.panel === name);
  }
}
function closeEditors() {
  element("booking-editor").hidden = true;
  element("artist-form").hidden = true;
  element("stage-form").hidden = true;
  editingPerformanceId = editingArtistId = editingStageId = null;
}
function openBooking(id = null) {
  closeEditors();
  showPanel("performances");
  editingPerformanceId = id;
  element("booking-form").reset();
  showError("booking-error", "");
  element("booking-title").textContent = id ? "Edit performance" : "Add performance";
  const select = element("booking-artist");
  select.innerHTML = '<option value="">Choose an artist</option><option value="new">+ New artist</option>';
  for (const artist of data.artists) select.add(new Option(artist.name, artist.id));
  const slot = data.performances.find(function (item) { return item.id === id; });
  if (slot) {
    select.value = slot.artistId;
    element("booking-day").value = slot.day;
    element("booking-start").value = slot.start;
    element("booking-end").value = slot.end;
  } else {
    element("booking-day").value = element("day-filter").value || "1";
  }
  element("booking-editor").hidden = false;
  updateBooking();
  if (slot) element("booking-stage").value = slot.stageId;
  updateAvailability();
  element("booking-editor").scrollIntoView({ block: "start" });
  select.focus({ preventScroll: true });
}
function draftArtist() {
  if (element("booking-artist").value !== "new") return findArtist(Number(element("booking-artist").value));
  return {
    id: nextId(data.artists),
    name: element("new-artist-name").value.trim(),
    genre: element("new-artist-genre").value.trim(),
    email: element("new-artist-email").value.trim(),
    equipment: readEquipment("new-artist-equipment")
  };
}
function draftPerformance() {
  const artist = draftArtist();
  return {
    id: editingPerformanceId,
    artistId: artist ? artist.id : 0,
    stageId: Number(element("booking-stage").value),
    day: Number(element("booking-day").value),
    start: element("booking-start").value,
    end: element("booking-end").value
  };
}
function updateBooking() {
  const isNew = element("booking-artist").value === "new";
  element("new-artist-fields").hidden = !isNew;
  for (const input of element("new-artist-fields").querySelectorAll("input")) input.disabled = !isNew;
  element("new-artist-name").required = isNew;
  element("new-artist-genre").required = isNew;
  const artist = draftArtist();
  element("artist-requirements").textContent = artist && !isNew ? "Requires: " + (artist.equipment.join(", ") || "No special equipment") : "";
  const select = element("booking-stage");
  const previous = select.value;
  const slot = draftPerformance();
  select.innerHTML = '<option value="">Choose a stage</option>';
  for (const stage of data.stages) {
    slot.stageId = stage.id;
    let label = "";
    if (artist && slot.start && slot.end) {
      label = getConflicts(slot, artist, stage, data.performances).length ? " - Unavailable" : " - Available";
    }
    select.add(new Option(stage.name + label, stage.id));
  }
  select.value = previous;
  if (!select.value) select.value = "";
  updateAvailability();
}

function updateAvailability() {
  const slot = draftPerformance();
  const artist = draftArtist();
  const box = element("booking-availability");
  const issues = getConflicts(slot, artist, findStage(slot.stageId), data.performances);
  const isNew = element("booking-artist").value === "new";
  if (isNew && (!artist.name || !artist.genre)) issues.push("Enter the new artist's name and genre.");
  if (isNew && duplicateName(data.artists, artist.name)) issues.push("This artist already exists. Select the existing artist instead.");
  if (isNew && !element("new-artist-email").validity.valid) issues.push("Enter a valid email address or leave it empty.");
  const complete = artist && slot.stageId && slot.start && slot.end;
  box.classList.toggle("has-conflict", Boolean(complete && issues.length));
  box.classList.toggle("is-clear", Boolean(complete && !issues.length));
  if (!complete) {
    box.textContent = !data.stages.length ? "Add a stage under Manage stages before booking a performance." : "Choose an artist, day, both times and a stage. Availability is checked as you type.";
  } else if (issues.length) {
    let list = "";
    for (const issue of issues) list += "<li>" + escapeHTML(issue) + "</li>";
    box.innerHTML = "<strong>Cannot save this performance</strong><ul>" + list + "</ul>";
  } else {
    box.innerHTML = "<strong>Ready to book</strong>Artist available. Stage available. Equipment matched.";
  }
  element("save-performance").disabled = issues.length > 0 || Boolean(storageProblem);
}

function savePerformance(event) {
  event.preventDefault();
  const artist = draftArtist();
  const slot = draftPerformance();
  if (!artist) return showError("booking-error", "Select an artist.");
  const isNew = element("booking-artist").value === "new";
  if (isNew && (!artist.name || !artist.genre)) return showError("booking-error", "Enter an artist name and genre.");
  if (isNew && duplicateName(data.artists, artist.name)) return showError("booking-error", "This artist already exists. Select them from the artist list.");
  const issue = checkConflict(slot, artist, findStage(slot.stageId), data.performances);
  if (issue) return showError("booking-error", issue);
  if (!slot.id) slot.id = nextId(data.performances);
  const next = {
    artists: isNew ? data.artists.concat(artist) : data.artists,
    stages: data.stages,
    performances: data.performances.filter(function (item) { return item.id !== slot.id; }).concat(slot)
  };
  // The new artist is not saved if the performance fails validation.
  if (saveData(next)) {
    closeEditors();
    element("day-filter").value = slot.day;
    element("stage-filter").value = "";
    renderSchedule();
    element("add-performance").focus();
    showNotice("Performance saved.");
  }
}

/* 7. ARTIST AND STAGE MAINTENANCE */
function editArtist(id) {
  closeEditors();
  editingArtistId = id;
  const artist = findArtist(id);
  element("artist-name").value = artist.name;
  element("artist-genre").value = artist.genre;
  element("artist-email").value = artist.email;
  fillEquipment("artist-equipment", artist.equipment);
  showError("artist-error", "");
  element("artist-form").hidden = false;
  element("artist-name").focus();
}
function saveArtist(event) {
  event.preventDefault();
  const artist = { id: editingArtistId, name: element("artist-name").value.trim(), genre: element("artist-genre").value.trim(), email: element("artist-email").value.trim(), equipment: readEquipment("artist-equipment") };
  if (!artist.name || !artist.genre) return showError("artist-error", "Enter a name and genre.");
  if (duplicateName(data.artists, artist.name, artist.id)) return showError("artist-error", "Another artist already uses this name.");
  const next = { ...data, artists: data.artists.map(function (item) { return item.id === artist.id ? artist : item; }) };
  const issue = checkFestival(next);
  if (issue) return showError("artist-error", "This change would affect a booked performance. " + issue);
  if (saveData(next)) { closeEditors(); showNotice("Artist updated across the festival."); }
}
function openStage(id = null) {
  closeEditors();
  editingStageId = id;
  element("stage-form").reset();
  element("stage-title").textContent = id ? "Edit stage" : "Add stage";
  showError("stage-error", "");
  if (id) {
    const stage = findStage(id);
    element("stage-name").value = stage.name;
    element("stage-capacity").value = stage.capacity;
    fillEquipment("stage-equipment", stage.equipment);
  }
  element("stage-form").hidden = false;
  element("stage-name").focus();
}
function saveStage(event) {
  event.preventDefault();
  const stage = { id: editingStageId || nextId(data.stages), name: element("stage-name").value.trim(), capacity: Number(element("stage-capacity").value), equipment: readEquipment("stage-equipment") };
  if (!stage.name) return showError("stage-error", "Enter a stage name.");
  if (!Number.isInteger(stage.capacity) || stage.capacity < 1 || stage.capacity > 1000000) return showError("stage-error", "Capacity must be a whole number between 1 and 1,000,000.");
  if (duplicateName(data.stages, stage.name, stage.id)) return showError("stage-error", "Another stage already uses this name.");
  const next = { ...data, stages: data.stages.filter(function (item) { return item.id !== stage.id; }).concat(stage) };
  const issue = checkFestival(next);
  if (issue) return showError("stage-error", "This change would affect a booked performance. " + issue);
  if (saveData(next)) { closeEditors(); showNotice("Stage saved."); }
}
function deleteRecord(kind, id) {
  if (kind !== "performance") {
    const booked = data.performances.some(function (slot) { return kind === "artist" ? slot.artistId === id : slot.stageId === id; });
    if (booked) { showNotice("Remove or reassign this " + kind + "'s performances before deleting it."); return; }
  }
  let label;
  if (kind === "performance") {
    const slot = data.performances.find(function (item) { return item.id === id; });
    label = findArtist(slot.artistId).name + "'s Day " + slot.day + " performance";
  } else label = kind === "artist" ? findArtist(id).name : findStage(id).name;
  if (!window.confirm("Delete " + label + "?")) return;
  const key = kind === "performance" ? "performances" : kind === "artist" ? "artists" : "stages";
  const next = { ...data };
  next[key] = data[key].filter(function (item) { return item.id !== id; });
  if (saveData(next)) { closeEditors(); showNotice("Deleted " + label + "."); }
}

/* 8. EVENTS: connect HTML buttons and forms to the functions above. */
function bindEvents() {
  element("add-performance").addEventListener("click", function () { openBooking(); });
  element("booking-form").addEventListener("submit", savePerformance);
  for (const id of ["close-booking", "cancel-booking", "cancel-artist", "cancel-stage"]) {
    element(id).addEventListener("click", function () { closeEditors(); element("add-performance").focus(); });
  }
  element("booking-form").addEventListener("input", function (event) {
    showError("booking-error", "");
    if (event.target.id === "booking-stage") updateAvailability();
    else updateBooking();
  });
  element("booking-form").addEventListener("change", function (event) {
    if (event.target.id === "booking-stage") updateAvailability();
    else updateBooking();
  });
  element("day-filter").addEventListener("change", renderSchedule);
  element("stage-filter").addEventListener("change", renderSchedule);
  element("artist-search").addEventListener("input", renderArtists);
  element("artist-form").addEventListener("submit", saveArtist);
  element("stage-form").addEventListener("submit", saveStage);
  element("add-stage").addEventListener("click", function () { openStage(); });
  for (const button of document.querySelectorAll("[data-panel]")) {
    button.addEventListener("click", function () { closeEditors(); showPanel(button.dataset.panel); });
  }
  // Event delegation: one listener also works for freshly rendered table rows.
  element("main").addEventListener("click", function (event) {
    const setButton = event.target.closest("[data-set]");
    if (setButton) { openBooking(Number(setButton.dataset.set)); return; }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const parts = button.dataset.action.split("-");
    const id = Number(button.dataset.id);
    if (parts[0] === "delete") deleteRecord(parts[1], id);
    else if (parts[1] === "performance") openBooking(id);
    else if (parts[1] === "artist") editArtist(id);
    else openStage(id);
  });
}
bindEvents();

for (const button of document.querySelectorAll("[data-view]")) {
  button.addEventListener("click", function () { changeView(button.dataset.view); });
}

// Another tab can update the same festival. Refresh its display too.
window.addEventListener("storage", function (event) {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  storageProblem = "";
  data = loadData();
  closeEditors();
  renderPage();
  showNotice(storageProblem || "Festival updated in another tab. Reopen any editor to use the latest details.");
});
renderPage();
if (storageProblem) showNotice(storageProblem);

