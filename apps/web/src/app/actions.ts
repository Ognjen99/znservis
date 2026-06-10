"use server";

import {
  CreateWorkerSchema,
  LocationSchema,
  MaterialGroupSchema,
  MaterialSchema,
  UpdateWorkerSchema,
  normalizeWorkerLoginName,
  workerAuthEmail
} from "@znservis/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient
} from "@/lib/supabase/server";

function nullableString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length ? text : null;
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      redirect("/login?error=email_not_confirmed");
    }

    redirect("/login?error=invalid_credentials");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=invalid_credentials");
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    redirect("/login?error=no_profile");
  }

  if (profile.role !== "admin" || !profile.active) {
    await supabase.auth.signOut();
    redirect("/login?error=not_admin");
  }

  redirect("/");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type WorkerFormState = {
  error?: string;
  success?: string;
  created?: {
    full_name: string;
    login_name: string;
    password: string;
  };
};

export async function createWorkerAction(
  _prevState: WorkerFormState,
  formData: FormData
): Promise<WorkerFormState> {
  await requireAdmin();

  try {
    const input = CreateWorkerSchema.parse({
      password: formData.get("password"),
      full_name: formData.get("full_name")
    });

    const loginName = normalizeWorkerLoginName(input.full_name);
    const email = workerAuthEmail(loginName);
    const admin = createSupabaseAdminClient();

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("login_name", loginName)
      .eq("role", "worker")
      .maybeSingle();

    if (existing) {
      return { error: "Radnik sa tim imenom vec postoji." };
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.full_name,
        login_name: loginName,
        role: "worker"
      }
    });

    if (error) {
      return { error: error.message };
    }

    if (data.user) {
      const { error: profileError } = await admin.from("profiles").upsert({
        id: data.user.id,
        full_name: input.full_name,
        login_name: loginName,
        role: "worker",
        active: true
      });

      if (profileError) {
        await admin.auth.admin.deleteUser(data.user.id);
        return { error: profileError.message };
      }
    }

    revalidatePath("/workers");

    return {
      success: "Radnik je uspesno kreiran.",
      created: {
        full_name: input.full_name,
        login_name: loginName,
        password: input.password
      }
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Greska pri kreiranju radnika."
    };
  }
}

export async function updateWorkerAction(formData: FormData) {
  await requireAdmin();

  const rawPassword = String(formData.get("password") ?? "").trim();

  const input = UpdateWorkerSchema.parse({
    id: formData.get("id"),
    full_name: formData.get("full_name"),
    password: rawPassword.length ? rawPassword : ""
  });

  const loginName = normalizeWorkerLoginName(input.full_name);
  const email = workerAuthEmail(loginName);
  const admin = createSupabaseAdminClient();

  const { data: worker, error: fetchError } = await admin
    .from("profiles")
    .select("id, role, login_name")
    .eq("id", input.id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!worker || worker.role !== "worker") {
    throw new Error("Radnik nije pronadjen.");
  }

  if (loginName !== worker.login_name) {
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("login_name", loginName)
      .eq("role", "worker")
      .neq("id", input.id)
      .maybeSingle();

    if (existing) {
      throw new Error("Radnik sa tim imenom vec postoji.");
    }
  }

  const authUpdate: { email: string; password?: string; user_metadata: Record<string, string> } = {
    email,
    user_metadata: {
      full_name: input.full_name,
      login_name: loginName,
      role: "worker"
    }
  };

  if (input.password && input.password.length >= 8) {
    authUpdate.password = input.password;
  } else if (input.password && input.password.length > 0) {
    throw new Error("Lozinka mora imati najmanje 8 karaktera.");
  }

  const { error: authError } = await admin.auth.admin.updateUserById(input.id, authUpdate);

  if (authError) {
    throw new Error(authError.message);
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: input.full_name,
      login_name: loginName
    })
    .eq("id", input.id)
    .eq("role", "worker");

  if (profileError) {
    throw new Error(profileError.message);
  }

  revalidatePath("/workers");
}

export async function deleteWorkerAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    throw new Error("Nedostaje ID radnika.");
  }

  const admin = createSupabaseAdminClient();
  const { data: worker, error: fetchError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!worker || worker.role !== "worker") {
    throw new Error("Radnik nije pronadjen.");
  }

  const { error } = await admin.auth.admin.deleteUser(id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/workers");
}

export async function createLocationAction(formData: FormData) {
  await requireAdmin();

  const input = LocationSchema.parse({
    name: formData.get("name"),
    address: nullableString(formData.get("address")),
    notes: nullableString(formData.get("notes")),
    active: formData.get("active") === "on"
  });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("locations").insert(input);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/locations");
}

export async function createMaterialGroupAction(formData: FormData) {
  await requireAdmin();

  const input = MaterialGroupSchema.parse({
    name: formData.get("name")
  });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("material_groups").insert(input);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/materials");
}

export async function createMaterialAction(formData: FormData) {
  await requireAdmin();

  const input = MaterialSchema.parse({
    name: formData.get("name"),
    group_id: nullableString(formData.get("group_id")),
    unit: formData.get("unit"),
    active: formData.get("active") === "on"
  });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("materials").insert(input);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/materials");
}

export async function setWorkerActiveAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("profiles").update({ active }).eq("id", id).eq("role", "worker");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/workers");
}

export async function setLocationActiveAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("locations").update({ active }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/locations");
}

export async function deleteLocationAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    throw new Error("Nedostaje ID lokacije.");
  }

  const admin = createSupabaseAdminClient();
  const { data: location, error: fetchError } = await admin
    .from("locations")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!location) {
    throw new Error("Lokacija nije pronadjena.");
  }

  const { error } = await admin.from("locations").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      throw new Error("Lokacija ima povezane izvestaje i ne moze biti obrisana.");
    }

    throw new Error(error.message);
  }

  revalidatePath("/locations");
}

export async function setMaterialActiveAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("materials").update({ active }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/materials");
}

export async function deleteMaterialAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    throw new Error("Nedostaje ID materijala.");
  }

  const admin = createSupabaseAdminClient();
  const { data: material, error: fetchError } = await admin
    .from("materials")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!material) {
    throw new Error("Materijal nije pronadjen.");
  }

  const { error } = await admin.from("materials").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      throw new Error("Materijal ima povezane izvestaje i ne moze biti obrisan.");
    }

    throw new Error(error.message);
  }

  revalidatePath("/materials");
}

export async function deleteReportAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    throw new Error("Nedostaje ID izvestaja.");
  }

  const admin = createSupabaseAdminClient();
  const { data: report, error: fetchError } = await admin
    .from("work_reports")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!report) {
    throw new Error("Izvestaj nije pronadjen.");
  }

  const { error } = await admin.from("work_reports").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/reports");
  revalidatePath("/");
}
