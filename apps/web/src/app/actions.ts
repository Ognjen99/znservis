"use server";

import {
  AssignWorkOrderMaterialsSchema,
  AssignWorkOrderWorkersSchema,
  CreateWorkOrderSchema,
  CreateWorkerSchema,
  LocationSchema,
  MaterialGroupSchema,
  MaterialSchema,
  UpdateWorkOrderStatusSchema,
  UpdateWorkerSchema,
  normalizeWorkerLoginName,
  workerAuthEmail
} from "@znservis/shared";
import { randomUUID } from "crypto";
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

function nullableDate(value: FormDataEntryValue | null) {
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

export async function createWorkOrderAction(formData: FormData) {
  const profile = await requireAdmin();

  const input = CreateWorkOrderSchema.parse({
    title: formData.get("title"),
    description: nullableString(formData.get("description")),
    location_id: formData.get("location_id"),
    scheduled_start: null,
    scheduled_end: null
  });

  const workerIds = formData.getAll("worker_id").map(String);
  const materialIds = formData.getAll("material_id").map(String);
  const materials = materialIds
    .map((materialId) => ({
      material_id: materialId,
      assigned_quantity: String(formData.get(`quantity_${materialId}`) ?? "").trim()
    }))
    .filter((material) => material.assigned_quantity.length > 0 && Number(material.assigned_quantity) > 0);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("work_orders")
    .insert({
      ...input,
      status: workerIds.length > 0 ? "assigned" : "created",
      created_by: profile.id
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (workerIds.length > 0) {
    const { error: assignError } = await supabase.from("work_order_assignees").insert(
      workerIds.map((workerId) => ({
        work_order_id: data.id,
        worker_id: workerId
      }))
    );

    if (assignError) {
      throw new Error(assignError.message);
    }
  }

  if (materials.length > 0) {
    const parsedMaterials = AssignWorkOrderMaterialsSchema.parse({
      work_order_id: data.id,
      materials
    });

    const { error: materialsError } = await supabase.from("work_order_materials").insert(
      parsedMaterials.materials.map((material) => ({
        work_order_id: data.id,
        material_id: material.material_id,
        assigned_quantity: material.assigned_quantity
      }))
    );

    if (materialsError) {
      throw new Error(materialsError.message);
    }
  }

  revalidatePath("/work-orders");
  revalidatePath("/");
  redirect(`/work-orders/${data.id}`);
}

export async function updateWorkOrderAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    throw new Error("Nedostaje ID radnog naloga.");
  }

  const input = CreateWorkOrderSchema.parse({
    title: formData.get("title"),
    description: nullableString(formData.get("description")),
    location_id: formData.get("location_id"),
    scheduled_start: null,
    scheduled_end: null
  });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("work_orders").update(input).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/work-orders");
  revalidatePath(`/work-orders/${id}`);
}

export async function setWorkOrderStatusAction(formData: FormData) {
  await requireAdmin();

  const input = UpdateWorkOrderStatusSchema.parse({
    id: formData.get("id"),
    status: formData.get("status")
  });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("work_orders").update({ status: input.status }).eq("id", input.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/work-orders");
  revalidatePath(`/work-orders/${input.id}`);
  revalidatePath("/");
}

export async function assignWorkOrderWorkersAction(formData: FormData) {
  await requireAdmin();

  const input = AssignWorkOrderWorkersSchema.parse({
    work_order_id: formData.get("work_order_id"),
    worker_ids: formData.getAll("worker_id")
  });

  const supabase = await createSupabaseServerClient();
  const { error: deleteError } = await supabase
    .from("work_order_assignees")
    .delete()
    .eq("work_order_id", input.work_order_id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { error: insertError } = await supabase.from("work_order_assignees").insert(
    input.worker_ids.map((workerId) => ({
      work_order_id: input.work_order_id,
      worker_id: workerId
    }))
  );

  if (insertError) {
    throw new Error(insertError.message);
  }

  const { data: order } = await supabase
    .from("work_orders")
    .select("status")
    .eq("id", input.work_order_id)
    .maybeSingle();

  if (order?.status === "created") {
    const { error: statusError } = await supabase
      .from("work_orders")
      .update({ status: "assigned" })
      .eq("id", input.work_order_id);

    if (statusError) {
      throw new Error(statusError.message);
    }
  }

  revalidatePath("/work-orders");
  revalidatePath(`/work-orders/${input.work_order_id}`);
}

export async function setWorkOrderMaterialsAction(formData: FormData) {
  await requireAdmin();

  const workOrderId = String(formData.get("work_order_id") ?? "");
  const materialIds = formData.getAll("material_id").map(String);
  const materials = materialIds
    .map((materialId) => ({
      material_id: materialId,
      assigned_quantity: String(formData.get(`quantity_${materialId}`) ?? "").trim()
    }))
    .filter((material) => material.assigned_quantity.length > 0 && Number(material.assigned_quantity) > 0);

  if (materials.length > 0) {
    AssignWorkOrderMaterialsSchema.parse({
      work_order_id: workOrderId,
      materials
    });
  } else if (!workOrderId) {
    throw new Error("Nedostaje ID radnog naloga.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: fetchError } = await supabase
    .from("work_order_materials")
    .select("material_id")
    .eq("work_order_id", workOrderId);

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const nextMaterialIds = new Set(materials.map((material) => material.material_id));
  const removedMaterialIds = (existing ?? [])
    .map((material) => material.material_id)
    .filter((materialId) => !nextMaterialIds.has(materialId));

  for (const materialId of removedMaterialIds) {
    const { error: deleteError } = await supabase
      .from("work_order_materials")
      .delete()
      .eq("work_order_id", workOrderId)
      .eq("material_id", materialId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  if (materials.length > 0) {
    const { error: upsertError } = await supabase
      .from("work_order_materials")
      .upsert(
        materials.map((material) => ({
          work_order_id: workOrderId,
          material_id: material.material_id,
          assigned_quantity: material.assigned_quantity
        })),
        { onConflict: "work_order_id,material_id" }
      );

    if (upsertError) {
      throw new Error(upsertError.message);
    }
  }

  revalidatePath("/work-orders");
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function uploadWorkOrderPlanAction(formData: FormData) {
  const profile = await requireAdmin();

  const workOrderId = String(formData.get("work_order_id") ?? "");
  const file = formData.get("file");

  if (!workOrderId) {
    throw new Error("Nedostaje ID radnog naloga.");
  }

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Izaberite PDF ili sliku plana.");
  }

  const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Dozvoljeni su samo PDF, JPG, PNG i WebP fajlovi.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${workOrderId}/${randomUUID()}-${safeName}`;
  const admin = createSupabaseAdminClient();
  const { error: uploadError } = await admin.storage.from("work-order-plans").upload(filePath, file, {
    contentType: file.type,
    upsert: false
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: insertError } = await admin.from("work_order_attachments").insert({
    work_order_id: workOrderId,
    file_path: filePath,
    file_name: file.name,
    mime_type: file.type,
    uploaded_by: profile.id
  });

  if (insertError) {
    await admin.storage.from("work-order-plans").remove([filePath]);
    throw new Error(insertError.message);
  }

  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function deleteWorkOrderAttachmentAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const workOrderId = String(formData.get("work_order_id") ?? "");

  if (!id || !workOrderId) {
    throw new Error("Nedostaje prilog.");
  }

  const admin = createSupabaseAdminClient();
  const { data: attachment, error: fetchError } = await admin
    .from("work_order_attachments")
    .select("file_path")
    .eq("id", id)
    .eq("work_order_id", workOrderId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!attachment) {
    throw new Error("Prilog nije pronadjen.");
  }

  await admin.storage.from("work-order-plans").remove([attachment.file_path]);

  const { error } = await admin.from("work_order_attachments").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function deleteWorkOrderAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    throw new Error("Nedostaje ID radnog naloga.");
  }

  const admin = createSupabaseAdminClient();
  const { count, error: countError } = await admin
    .from("work_reports")
    .select("id", { count: "exact", head: true })
    .eq("work_order_id", id);

  if (countError) {
    throw new Error(countError.message);
  }

  if ((count ?? 0) > 0) {
    throw new Error("Radni nalog ima dnevne zapise i ne moze biti obrisan.");
  }

  const { data: attachments } = await admin
    .from("work_order_attachments")
    .select("file_path")
    .eq("work_order_id", id);

  const { error } = await admin.from("work_orders").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  const paths = (attachments ?? []).map((attachment) => attachment.file_path);
  if (paths.length > 0) {
    await admin.storage.from("work-order-plans").remove(paths);
  }

  revalidatePath("/work-orders");
  revalidatePath("/");
}
