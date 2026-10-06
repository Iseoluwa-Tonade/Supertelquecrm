import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const CRM_MCP_TOOLS = [
  {
    name: "crm_overview",
    description: "Get live CRM counts and pipeline totals for the signed-in workspace.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_contacts",
    description: "Search CRM contacts by name, email, phone, or job title.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_companies",
    description: "List CRM companies, optionally filtered by a search query.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_pipeline",
    description: "List revenue pipeline deals from the CRM.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_email_threads",
    description: "Search CRM email conversations by subject.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_email_thread",
    description: "Get the messages in one CRM email conversation thread.",
    inputSchema: {
      type: "object",
      properties: { thread_id: { type: "string" } },
      required: ["thread_id"],
      additionalProperties: false,
    },
  },
  {
    name: "create_task",
    description: "Create a CRM task. This is a write action.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        company: { type: "string" },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        due: { type: "string", description: "ISO date YYYY-MM-DD" },
        notes: { type: "string" },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "update_pipeline_item",
    description: "Update the status, priority, due date, value, or notes of a CRM deal/project/task. This is a write action.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        due: { type: "string" },
        value: { type: "number" },
        notes: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
];

export function createBearerSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
}

export async function authenticateMcpBearer(token: string) {
  const supabase = createBearerSupabase(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired access token");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id,organisation_id,role,status,registration_complete")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.status !== "active" || !profile.organisation_id) {
    throw new Error("CRM profile is not authorized");
  }

  return { supabase, user: userData.user, profile };
}

function asText(value: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

export async function executeCrmTool(
  supabase: SupabaseClient,
  userId: string,
  organisationId: string,
  toolName: string,
  args: Record<string, any>,
) {
  if (toolName === "crm_overview") {
    const [contacts, companies, deals, projects, tasks, threads] = await Promise.all([
      supabase.from("crm_contacts").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId),
      supabase.from("crm_companies").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId),
      supabase.from("crm_board_items").select("value,status", { count: "exact" }).eq("organisation_id", organisationId).eq("type", "deal"),
      supabase.from("crm_board_items").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).eq("type", "project"),
      supabase.from("crm_board_items").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).eq("type", "task"),
      supabase.from("crm_email_threads").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId),
    ]);
    const openDeals = (deals.data || []).filter((d: any) => !["closed_won","closed_lost"].includes(d.status));
    const pipelineValue = openDeals.reduce((sum: number, d: any) => sum + Number(d.value || 0), 0);
    return asText({
      contacts: contacts.count || 0,
      companies: companies.count || 0,
      deals: deals.count || 0,
      openDeals: openDeals.length,
      pipelineValue,
      projects: projects.count || 0,
      tasks: tasks.count || 0,
      emailThreads: threads.count || 0,
    });
  }

  if (toolName === "search_contacts") {
    const limit = Math.min(Number(args.limit || 25), 100);
    let query = supabase
      .from("crm_contacts")
      .select("id,display_name,email,phone,job_title,status,source,last_contacted_at,company_id,created_at")
      .eq("organisation_id", organisationId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (args.query) {
      const q = String(args.query).replace(/,/g, " ");
      query = query.or(`display_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,job_title.ilike.%${q}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return asText(data || []);
  }

  if (toolName === "list_companies") {
    const limit = Math.min(Number(args.limit || 25), 100);
    let query = supabase
      .from("crm_companies")
      .select("id,name,domain,website,phone,address,status,source,notes,created_at")
      .eq("organisation_id", organisationId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (args.query) {
      const q = String(args.query).replace(/,/g, " ");
      query = query.or(`name.ilike.%${q}%,domain.ilike.%${q}%,website.ilike.%${q}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return asText(data || []);
  }

  if (toolName === "list_pipeline") {
    const limit = Math.min(Number(args.limit || 50), 100);
    let query = supabase
      .from("crm_board_items")
      .select("id,title,company,status,owner,priority,value,due,notes,company_id,primary_contact_id,updated_at")
      .eq("organisation_id", organisationId)
      .eq("type", "deal")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (args.status) query = query.eq("status", String(args.status));
    const { data, error } = await query;
    if (error) throw error;
    return asText(data || []);
  }

  if (toolName === "search_email_threads") {
    const limit = Math.min(Number(args.limit || 25), 100);
    let query = supabase
      .from("crm_email_threads")
      .select("id,subject,last_message_at,message_count,provider,provider_account_id,board_item_id,contact_id,company_id")
      .eq("organisation_id", organisationId)
      .order("last_message_at", { ascending: false })
      .limit(limit);
    if (args.query) query = query.ilike("subject", `%${String(args.query)}%`);
    const { data, error } = await query;
    if (error) throw error;
    return asText(data || []);
  }

  if (toolName === "get_email_thread") {
    const { data, error } = await supabase
      .from("crm_emails")
      .select("id,direction,from_address,from_name,to_addresses,cc_addresses,subject,summary,body_text,sent_at,received_at,folder_name,has_attachments")
      .eq("organisation_id", organisationId)
      .eq("thread_id", String(args.thread_id))
      .order("created_at", { ascending: true });
    if (error) throw error;
    return asText(data || []);
  }

  if (toolName === "create_task") {
    const { data, error } = await supabase
      .from("crm_board_items")
      .insert({
        organisation_id: organisationId,
        user_id: userId,
        assigned_to: userId,
        visibility: "team",
        type: "task",
        title: String(args.title),
        company: String(args.company || ""),
        owner: "",
        priority: args.priority || "medium",
        value: 0,
        due: args.due || null,
        status: "todo",
        notes: String(args.notes || ""),
      })
      .select("*")
      .single();
    if (error) throw error;
    return asText(data);
  }

  if (toolName === "update_pipeline_item") {
    const patch: Record<string, unknown> = {};
    for (const key of ["status","priority","due","value","notes"]) {
      if (args[key] !== undefined) patch[key] = args[key];
    }
    patch.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from("crm_board_items")
      .update(patch)
      .eq("organisation_id", organisationId)
      .eq("id", String(args.id))
      .select("*")
      .single();
    if (error) throw error;
    return asText(data);
  }

  throw new Error(`Unknown CRM MCP tool: ${toolName}`);
}
