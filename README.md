# FEST.EXE — Festival Management

A simple management-only website using HTML, CSS and JavaScript.
The homepage is the workspace: Schedule, Artists and Stages.

## Open the project

Open index.html using VS Code Live Server. Keep the same browser and server address
to continue using your saved records. All assets are local; no online fonts or
libraries are required.

Alternatively, open a terminal in this folder and run:

    python -m http.server 5500 --bind 127.0.0.1

Visit http://127.0.0.1:5500. Python only serves static files for preview;
the website itself contains no Python, framework or backend.

You can open index.html directly too, but browser storage behaviour for file://
pages varies. Live Server or static hosting is recommended for persistent use.

## GitHub Pages

The `main` branch includes a GitHub Actions workflow that publishes this static
site. In the repository settings, open **Pages** and set the source to **GitHub
Actions**. After pushing to `main`, the site is deployed at:

https://seehraguruman-bit.github.io/FEST-EXE/

## Files

- index.html: the complete management interface and its three HTML forms.
- style.css: the dark layout, compact navigation, blue schedule blocks and forms.
- app.js: arrays, storage, rendering, form handling and conflict checks.
- staff.html: a compatibility redirect to index.html for old bookmarks.

The public visitor page and its JavaScript have been removed.
The original files and earlier designs are backed up separately in the workspace.
Unrelated projects are not included in this download.

## Using the workspace

1. Schedule opens by default.
2. Choose a festival day and optionally a stage.
3. Switch between Timetable and List; filters apply to both.
4. Click a blue timetable block or its Edit button to edit a performance.
5. Click Add performance to create a booking.
6. Choose an existing artist or + New artist. Enter new artist details in place.
7. Set the day, start/end time and stage.
8. Fix any red conflict messages. Save becomes available when the form is valid.

Artists lets you search, edit and remove artist records.
New artists are created as part of a performance booking.
Stages lets you add stages and edit their names, capacities and equipment.
Booked artists or stages cannot be deleted until their bookings are removed
or reassigned.

There are three festival days. A performance must finish on the same day.
Back-to-back performances are allowed; setup buffers are outside this project's scope.
The time grid covers the full day from midnight to midnight; scroll horizontally
to view later hours.
For very short sets, List provides more space to read the exact details.

## Conflict checks

The live form checks:
- Complete and valid times, with end after start.
- No overlapping performances on the same stage on the same day.
- No double-booked artist, including across different stages.
- Required artist equipment is available on the chosen stage.
- New artist names do not duplicate existing names, ignoring case and extra spaces.

Red feedback lists every issue and disables Save.
Green feedback means the artist, time and stage pass the checks.
Checks run again when saving, and at the storage-write boundary.
An edited performance is excluded from comparison with itself.
Equipment edits are checked against already booked performances.
A failed booking does not create an orphan artist.

## Storage and scope

Data is stored in localStorage under the unchanged key fest-exe-simple-v2.
Existing records on the same browser origin remain compatible.
Other tabs on the same origin refresh when the saved data changes.
There is no server database, shared team account or secure sign-in.
Data is not shared across devices. Use fictional data for demonstrations.
Unreadable saved data is not overwritten; saving is blocked to protect it.
If storage is full or unavailable, the form stays open and the save fails visibly.

## Viva notes

HTML:
- header, nav, main, section and footer describe the structure.
- label for matches an input id.
- required, type=email and type=number provide native form validation.
- hidden shows or hides sections without navigating to another page.
- defer runs app.js after the HTML has been parsed.

CSS:
- :root holds colour variables, read with var(...).
- Flexbox arranges navigation, toolbars and form fields.
- padding is inside spacing; margin is outside spacing.
- border-radius gives panels and buttons slightly rounded corners.
- The 760px media query stacks controls on smaller screens.
- overflow-x: auto lets only the timetable/table scroll horizontally.
- position: relative creates the timetable coordinate system.
- position: absolute places each blue block at its time.
- position: sticky keeps stage names visible when scrolling.
- :focus-visible makes keyboard focus clear.
- The timetable's repeating gradient draws hourly grid lines.

JavaScript:
- artists, stages and performances are arrays of objects.
- IDs connect records, so renaming an artist does not break their bookings.
- find locates an item; filter selects/removes items; map updates an array.
- some checks whether at least one item matches; includes checks membership.
- slice().sort() sorts a copy of the performances.
- JSON.stringify converts data to text for localStorage; JSON.parse reads it.
- addEventListener connects controls to named functions.
- preventDefault stops form submission from reloading the page.
- Event delegation handles the buttons inside freshly rendered timetable/table rows.
- textContent and escapeHTML keep user-entered text from becoming executable HTML.
- try/catch handles storage failures.

The overlap rule:

    newStart < existingEnd && newEnd > existingStart

Times are converted to minutes using hours * 60 + minutes.
Only compare performances on the same day.
Strict comparisons allow one performance to start exactly when another ends.

Timetable positioning:

    left = (startMinutes - firstVisibleMinute) * 2
    width = (endMinutes - startMinutes) * 2

Every minute occupies 2 pixels; each hourly grid interval is 120 pixels.
The full-day window is 00:00–24:00. Scroll horizontally to view the entire grid.

## Verification

JavaScript syntax and HTML structure were checked.
20 regression checks passed using an isolated DOM/event test harness:
management startup, removal of visitor code, saved-data compatibility, navigation,
booking entry, timetable/list switching, filters, separate day groups, live red
conflict feedback, boundary times, artist collisions, equipment checks, editing,
atomic booking creation, deletion safeguards, storage failure and text escaping.

An isolated browser preview was attempted, but the browser process could not start
in this environment. Visual and full browser end-to-end verification are incomplete.

