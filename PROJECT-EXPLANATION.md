# SuperTelque CRM — User Guide (Every Screen, Every Button)

*Prepared for: SuperTelque CRM clients and stakeholders*
*This guide walks through the logged-in application page by page, explaining what every button, control, and click does. It covers only the main application (the sidebar pages) — not the sign-in/registration screens.*

---

## Before we start: how to get around

**The sidebar** (dark panel on the left) is the main menu. It is grouped into sections — *Overview, Revenue, Delivery, Finance, Operations* — and each entry is a button that takes you to that page. The entries you see depend on your role and on the features your company has switched on; anything you aren't allowed to see is hidden from you entirely.

- **Collapse / expand the sidebar** — the button at the very bottom of the sidebar. It shrinks the menu to just icons (and back), giving you more room for content.
- **On a phone or small screen**, the sidebar is hidden and a **hamburger menu (☰) appears at the top-left** — tap it to slide the menu in, tap outside it to close.
- **The top bar** has three things:
  - **Search box** — a global search for deals, clients, and files (ready for future use).
  - **Theme toggle (🌙/☀️)** — switches between dark and light appearance.
  - **Your account button** (your initials, top-right) — click it to open a small menu showing your email and job title, with a **Sign out** button.
- **Toasts** — whenever you save something, a small confirmation appears briefly at the top of the screen ("Saved", "Document uploaded", etc.). These are just notices; nothing to click.

**One rule that applies everywhere:** the blue **"Save"** button you'll meet on deal/project cards behaves differently depending on your role.

- **Admins and managers** save changes instantly.
- **Viewers and other roles** don't change the data directly — their save submits a *change request* that a manager must approve on the **Approvals** page. You'll see a message like "Change request submitted for review".

---

## Overview (Dashboard) — *Operations*

This is the landing page after sign-in: a read-only summary of the whole business.

- **Weekly digest** (top right, ✨) — a button that takes you to the **Pipeline** page.
- **New item** (top right, +) — takes you to the **Projects** page (to add work).
- **Your role badge** — shows your role (Admin / Manager / Owner / Viewer). Just a label.
- **Four KPI cards** — *Pipeline value* (with active-deal count and average deal size), *Win rate*, *Due this week* (with overdue count), *Approvals* (how many changes are waiting). These are informational.
- **Pipeline overview** panel:
  - **Bar / Pie** — two buttons that switch the chart between a bar chart and a donut chart of the same data.
  - **Full pipeline →** — a link that takes you to the **Pipeline** page.
- **At a glance** — seven quick counts (active deals, closed deals, documents, unread messages, today's activity, overdue, my deals). Informational.
- **Active deals** panel — the ten most recent deals in a table. **View all** takes you to the **Pipeline** page.
- **Recent activity** — the five most recent log entries. **View log →** takes you to the **Activity** page.
- **Stage distribution** — cards showing how many deals sit in each pipeline stage. Informational.

---

## Activity — *Operations*

A spreadsheet-style log of daily work (emails, calls, meetings, proposals, delivery, admin).

**For admins and managers:**
- **Quick add** — click it to reveal a text box, a **channel dropdown** (Email, Call, Meeting, Proposal, Delivery, Admin, General) and two buttons:
  - **Add** — saves the new activity for today as "Open".
  - **✕** — cancels and hides the form. (Pressing **Enter** in the box also saves; **Escape** cancels.)
- **Search box** — filters the list by activity title or channel as you type.
- **Channel dropdown** — filters by one channel or "All channels".
- **Status dropdown** — filters to All / Open / Done.
- **Field** button — opens the **Add custom field** popup so you can add your own column to the table:
  - **Field name** box — type the column name (e.g. "Client name").
  - **Field type** dropdown — Text, Select (dropdown), Date, or Checkbox.
  - **Add field** — creates the column; **Cancel** closes the popup.
- **Column headers** — click any header (Title, Channel, Date, or a custom field) to sort the table by that column; click again to reverse the order.
- **Any cell** — click to edit it in place. Text cells become a text box, channel becomes a dropdown, date becomes a date picker. Press **Enter** (or click away) to save; **Escape** to cancel.
- **Checkbox column** (left) — tick it to mark an activity **Done**; untick to reopen it. Rows that are Done appear dimmed.
- **✕ on the right of a row** (appears when you hover) — deletes that activity.

**For viewers:** the whole table is read-only — no Quick add, no Field button, no editable cells, no delete.

**Custom fields panel** (below the table, only if you created fields) — lists your custom columns, each with a **Remove** button to delete it.

---

## Notifications — *Overview*

A read-only feed that merges three types of events into one list, newest first:
- **Invite requests** — someone wants to join your company.
- **Approval requests** — a change to a deal/project is waiting for review.
- **Messages** — unread direct messages.

Each item shows a coloured dot, a type tag (invite / approval / message), a short description, and a date. There are no buttons — it's for awareness. (To act on an approval, go to **Approvals**; to answer a message, go to **Messages**; to review a join request, go to **Team & invites**.)

---

## Messages — *Operations*

Direct messaging between teammates.

- **Conversation list** (left) — each row is a thread with a person; it shows their name, a preview of the last message, and a number badge if there are unread messages. **Click a row** to open that conversation; it is automatically marked as read.
- **New message** (top right, managers and admins only) — opens a compose form:
  - **Teammate dropdown** — pick the person to message.
  - **Message box** — write your message.
  - **Send** — delivers the message instantly. **Cancel** closes the form.
- **The open conversation** (right) — messages appear as chat bubbles (yours in colour, theirs in grey) with the time. At the bottom:
  - **Reply box** — type a reply.
  - **Send** — sends it.
- Everyone else (non-managers) can reply to conversations but cannot start new ones — a note explains that a manager or admin can start one with you.

---

## Pipeline — *Revenue*

A read-only snapshot of the sales journey. No buttons — it's for viewing:
- **Four KPI cards** — Open deals, Open value, Due soon (next 7 days), High priority.
- **Pipeline board** — the top four deals as cards (title, company, owner, priority, value, stage, due).
- **Journey snapshot** — up to six deal stages with the count and dollar value at each stage.

*To actually work the pipeline (add, drag, edit deals), use the Focus board below.*

---

## Clients — *Revenue*

Your accounts, built automatically from the deals in your CRM.

- **Search box** — filters the list by company name as you type.
- **Accounts table** — each row shows the company, number of deals, owner avatars (with a **+n** chip if more than three owners), and total value.
  - For **admins**, the value is shown in dollars. For everyone else it appears as **•••••** with a note underneath: "Contract values are only visible to admins."
- **Add client** (top right, +) — currently a placeholder (not wired to a form yet).

---

## Contacts & Leads — *Revenue*

Two panels side by side:

- **Contacts** (left) — your company's directory. Each row shows an avatar, name, job title · department, a status tag (Active / Invited / Suspended / Uninvited), and two icons:
  - **✉ email icon** — opens your email program addressed to that person.
  - **☎ phone icon** — starts a call to that person (only when a number is saved).
  - **Search box** — filters by name, email, or job title.
- **Inbound leads** (right) — the four most recent deals, each tagged **Hot / Warm / Cool** based on value (over $50k = Hot, over $10k = Warm, otherwise Cool), with company, value (admins only), and owner.
- **New contact** (top right, +) — currently a placeholder (not wired up yet).

---

## Sales — *Revenue*

A sales-performance dashboard. **Viewers** see a "restricted" panel instead of the page.

- **Four KPI cards** — Orders this month, Order value, Avg order size, Win rate.
- **Sales orders** — a table of every deal (deal title, client, rep, value, status tag).
- **Quota attainment** — up to five sales reps, each with a progress bar showing their won value as a percentage of a $100,000 target. The bar turns green at 100%+.
- **Won revenue** — a bar chart of won-deal value across the last six months.
- **New order** (top right, +) — currently a placeholder (not wired up yet).

---

## Pricing — *Revenue* *(admins only)*

Manage your service catalog and calculate quotes on the fly. Non-admins just see the note "Only admins can access the pricing calculator."

**Add / edit a service** form:
- **Service name** box, **Unit price (USD)** box, **Billed** dropdown (Flat / Hourly / Per seat / Monthly).
- **Add service** — saves the new service to your catalog. **Cancel** appears when editing.

**Service catalog** — your list of services, each with:
- **Edit** — loads that service into the form above so you can change it (button becomes **Save changes**, with a **Cancel**).
- **✕** — deletes the service (asks for confirmation first).

**Quote calculator:**
- Each service has a **quantity box** — type a number and a per-line total appears instantly.
- **Discount %** and **Tax %** boxes — enter percentages.
- The panel shows live **Subtotal, Discount (−), Tax (+), Total**.
- **Reset calculator** — clears all quantities, discount, and tax back to zero.
- *(Quotes are calculated on screen; they aren't saved as documents yet.)*

---

## Projects — *Delivery*

A read-only delivery overview. No buttons:

- **Four KPI cards** — Open projects, Delivered, Open value, Due soon.
- **Active projects** — the first six projects as cards (title, company, owner, a progress-style bar, project type tag, due date).
- **Delivery health** — the first five open projects with a summary line such as "X overdue projects need attention."

*To add or edit projects, use the Focus board / detail panel.*

---

## Tasks (Task scheduling) — *Delivery*

Assign tasks to teammates. *(The current build keeps tasks in the browser only — they reset on reload — and the "notified" message is a simulated notice.)*

**For admins and managers — "Assign a new task" form:**
- **Task title** box, **Assignee** dropdown (pick a teammate).
- **Brief** box — what needs to be done.
- **Project** dropdown (General or example projects), **Due date** picker, **Priority** dropdown (High / Medium / Low).
- **Require file upload as proof of work** checkbox — marks the task as needing a deliverable file.
- **Assign task** — adds the task to the list and shows "Task assigned and teammate notified."

**Scheduled tasks** table — all assigned tasks (title, brief, assignee, due, priority, status; a paperclip icon marks tasks that require a file).

**Today's schedule** — the first few dated tasks for a quick glance.

---

## My tasks — *Delivery*

Your personal task list. *(Also demo data held in the browser in this build.)*

- **Filter pills** — All / Todo / In progress / Submitted / Done. Click one to filter the list.
- **Three summary cards** — Open, Awaiting review, Completed.
- **Each task card** shows the title, brief, priority tag, status tag, a **"File required"** tag when applicable, an attached-file tag when one is uploaded, task id, project, due date, and who assigned it. Depending on status, the card has:
  - **Start** — moves a Todo task to In progress.
  - **Upload / Replace** (on file-required tasks) — attaches a demo deliverable file.
  - **Mark done** — completes the task. It is **greyed out** if the task requires a file and none is uploaded yet. Completing shows "completed · [assigner] notified".

---

## Focus — *Delivery* (the main working board)

This is the hands-on **Kanban board** used to actually run the pipeline and projects.

- **Three columns** — **Overdue**, **Next 7 days**, and **Later** — cards are placed by their due date.
- **Filter tabs** at the top — All / Deal / Project (or whatever item types exist), plus **Owner** and **Priority** dropdowns to narrow what you see.
- **Each card** shows the company, title, owner avatar, priority tag, value (managers) or due date (everyone else), and the due label.
- **Drag a card** to a different column to change its status:
  - *Admins/Managers*: the change is saved to the database instantly.
  - *Other roles*: a change request is submitted for approval (you'll be told if one is already pending). A small "pending change" badge appears on the card.
  - *Viewers*: cards can't be dragged.
- **+ button** at the top of each column — creates a new deal or project in that column. *Managers*: created instantly. *Other roles*: a create request is submitted for review.
- **Click a card** — opens the **detail panel** that slides in from the right:

  **The detail panel** (also shown whenever a card is selected) contains the full edit form:
  - **Title**, **Company**, **Owner** boxes.
  - **Type** dropdown (Deal / Project), **Priority** dropdown (High / Medium / Low).
  - **Status** dropdown — the list of journey stages.
  - **Value (USD)** box — shown as "Value" for non-admins.
  - **Due date** picker, **Notes** box, **Sales document link** box.
  - **Save** — applies changes (instantly for managers, as a review request otherwise).
  - **Delete** — asks "Delete this item?" and removes it (instantly for managers, as a review request otherwise).
  - **Sales document** — if a link was saved, an "Open sales document →" link appears.
  - **Linked documents** — lists files attached to this deal/project.
  - **✕** — closes the panel.
  - If there's a pending change request on the item, a warning banner appears at the top of the panel.

---

## Documents — *Delivery*

Upload, preview, and manage files linked to deals and projects.

**Upload (admins and managers; viewers are read-only):**
- **Drop zone** — drag and drop files anywhere on it, or click it to open your file browser. Multiple files are allowed, up to 20 MB each.
- **Link to account or project** dropdown — optionally attach the upload to a deal/project (the file then also appears in that item's detail panel).

**Files panel:**
- **Filter dropdown** ("All accounts" or a specific account) — filters the grid to files linked to that account.
- **Each file card** shows a type icon, the file name, the linked account, size, and upload date, with:
  - **Preview** — opens the file in a popup: images, PDFs, video and audio play inline, Office files (Word/Excel/PowerPoint) open in a built-in viewer, and unsupported types show a **Download** button. Click outside the popup (or the **✕**) to close it.
  - **✕** (admins, managers, or the person who uploaded) — deletes the file after asking "Delete this document? This can't be undone."

---

## Inventory — *Delivery*

Stock tracking. *(In this build the data is sample/demo — nothing is saved.)*

- **KPI cards** — SKUs tracked, items below reorder point, stock value at cost (admins/managers only), movements in the last 7 days.
- **Stock on hand** table — SKU, item and category, warehouse location, on-hand quantity, reorder threshold, cost (admins/managers only — a note explains this), price, and a status tag: **In stock / Reorder / Out of stock**.
- **Recent movements** — inbound / outbound / adjustment entries with reference, person, date, and signed quantity.
- **Receive stock** (top right) — currently a placeholder (not wired up yet).

---

## Invoicing — *Finance* *(admins and managers)*

A billing overview built from your deals. **Viewers and owners** see a "restricted" panel instead.

- **KPI cards** — Invoiced, Collected, Outstanding (with overdue count), Avg days to pay.
- **Invoices table** — one row per deal: invoice number (INV-…), client, issued date, due date, amount, balance, and a status tag. A **send-reminder (✈) icon** sits at the end of each row — currently a placeholder.
- **New invoice** (top right, +) — currently a placeholder (not wired up yet).

---

## Accounting — *Finance* *(admins only)*

A simplified financial snapshot. Non-admins see a "restricted" panel.

- **KPI cards** — Cash on hand, Revenue (MTD), Expenses (MTD), Net margin. *(The cash and expense figures are demo values.)*
- **General ledger** — journal-style rows derived from your most recent closed-won deals (date, REF code, account "Sales Revenue", memo, and a credit amount), with a **Totals** row.
- **Expense mix** — a monthly breakdown of expenses (Payroll, Software & tools, Office & facilities, Marketing, Travel & logistics, Professional fees) as bars with amounts.

---

## Approvals — *Operations*

Where proposed changes to deals/projects are decided. Every create / update / delete request from non-manager roles lands here.

- **Each request card** shows the account and title, the action (Create / Update / Delete), who requested it, when, and a "pending" tag.
- For update requests, a **before → after** comparison lists the changed fields (the dollar value row is hidden from non-admins).
- **Withdraw** — the person who submitted the request can cancel their own.
- **Approve** — applies the change to the CRM immediately and records who approved it. *(Admins and managers only.)*
- **Reject** — marks the request rejected without applying it. *(Admins and managers only.)*
- If you're a non-manager viewing someone else's request, you'll see "Waiting for manager approval" instead of the buttons.

---

## Team & invites — *Operations* *(admins only)*

Run the team. Non-admins see the note "Only admins can manage the team."

- **Three KPI cards** — Active members, Pending invites, Visible page grants.
- **Pending requests** (only when there are some) — teammates who asked to join your company. Each row shows the person and job title, with:
  - **View profile** — opens a profile card (see below).
  - **Reject** — declines their request.
  - **Invite** — approves them as a **viewer** member of the company.
- **Teammates** table — every member with:
  - **Role dropdown** (Admin / Manager / Owner / Viewer) — click it to change that person's role (you can't change your own).
  - **Status** (Active).
  - **View profile** — opens the member profile card.
  - **Access** — opens the access panel for that person. If they have restrictions, the button shows **Access***.
- **Invite user** (top right) — opens the invite drawer:
  - **Email address** box and **Role** dropdown.
  - **Send invite** — creates the account and emails the invitation (shows "Sending…" while it works, then "Invite sent to …"). **Close (✕)** cancels.
- **Access drawer** — a grid of checkboxes, one per page. Unticking a page hides it from that person's sidebar; every checkbox you click saves immediately. **Reset to unrestricted** clears all restrictions. You can't restrict your own access.
- **Member profile card** (drawer) — an avatar, role/status/job-title tags, and quick actions:
  - **Email** — opens an email to them.
  - **Call** — starts a call (if a phone number is saved).
  - **Copy button** — copies their email to the clipboard.
  - Below: Employment (department, job title, employee ID, start date), Contact (email, phone, address), and Emergency contact (name, phone) information.

---

## Reports — *Operations*

A read-only catalogue of example reports (title, type, period, author, status like Final/Draft). Nothing is clickable yet — downloads aren't implemented in this build.

---

## Settings — *Operations*

A read-only page showing your **Workspace name**, **Plan** (Professional), **Member count**, and **Your role**. No settings are editable here yet.

---

## My profile — *Operations / Account*

Your account, HR details, and (for admins) company configuration.

**Top area:**
- **Edit profile** (shown after you've saved once) — reveals the form again so you can change your details.
- **Status banners** — amber if your join request is pending approval, green when you've been approved, or a notice if you haven't joined a company yet, with a button:
  - **Set up your company** (if you chose to create an organisation) — takes you to the CRM setup wizard.
  - **Browse organisations** — takes you to the Organisations page.
  - *(These buttons are disabled until you save your profile once.)*

**Account panel** — shows your email, organisation, role, and status.

**For non-admins — HR details form:**
- Fields: **Display name, Phone, Job title, Department, Employee ID, Start date, Address, Emergency contact name, Emergency contact phone.** All except the start date are required.
- **Save profile** — saves your details and, if you're joining a company, submits your join request to the admin. The button shows "Saved ✓" when done.

**For admins — Organisation settings form:**
- **Company name**, **Company email**, **Phone**, **Website**, **Address** boxes.
- **Company type** dropdown — B2B, B2C, Agency, SaaS, Marketplace, Nonprofit, or Other (with a short description of each).
- **Enabled CRM features** — a grid of checkboxes (Overview, Pipeline, Projects, Activity, Documents, Messages, Approvals, Focus, Team, Pricing). **My Profile is always on.** Unticking a feature hides that page from your whole company's sidebar.
- **Save organisation settings** — applies the changes.
- **Your profile** form (for admins, a short version) — Display name, Phone, Job title, and **Save profile**.

---

## Organisations — *Account*

Used when you haven't joined a company yet: browse every registered organisation and request to join one.

- **Request to join** (next to each company) — sends a pending join request to that company's admin, then takes you to **My profile**. The button shows "Sending request…" while it works. You'll be let into the app once the admin approves (via **Team & invites**).

---

## One-page cheat sheet (who sees what)

| Page | Admin | Manager | Owner | Viewer |
|---|---|---|---|---|
| Dashboard, Activity, Messages, Documents, Focus, Projects, Pipeline, Clients, Contacts, Notifications, Approvals, Reports, My tasks, Tasks, Settings, Profile | ✅ | ✅ | ✅ | ✅ |
| Sales | ✅ | ✅ | ✅ | 🔒 restricted |
| Invoicing | ✅ | ✅ | 🔒 restricted | 🔒 restricted |
| Pricing | ✅ | 🔒 hidden | 🔒 hidden | 🔒 hidden |
| Accounting | ✅ | 🔒 restricted | 🔒 restricted | 🔒 restricted |
| Team & invites | ✅ | 🔒 hidden | 🔒 hidden | 🔒 hidden |

*✅ = available · 🔒 = not available. Admin also sees dollar values everywhere; other roles see masked values on Clients, Approvals, and Kanban cards, and no cost column in Inventory.*

---

*This guide reflects the current build of the application. Items labelled "placeholder" are visual-only buttons that are expected to be wired up in future releases.*
