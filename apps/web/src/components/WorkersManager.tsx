"use client";

import { sr } from "@znservis/i18n";
import { Fragment, useActionState, useState } from "react";
import {
  createWorkerAction,
  deleteWorkerAction,
  setWorkerActiveAction,
  updateWorkerAction,
  type WorkerFormState
} from "@/app/actions";
import { PasswordField } from "@/components/PasswordField";
import { TableWrap } from "@/components/TableWrap";
import { joinFullName, splitFullName } from "@/lib/workerName";

type WorkerRow = {
  id: string;
  full_name: string;
  login_name: string | null;
  active: boolean;
  created_at: string;
};

type WorkersManagerProps = {
  workers: WorkerRow[];
};

const initialCreateState: WorkerFormState = {};

function CreatedWorkerDetails({ created }: { created: NonNullable<WorkerFormState["created"]> }) {
  const [visible, setVisible] = useState(false);
  const { firstName, lastName } = splitFullName(created.full_name);

  return (
    <div className="worker-created-card">
      <h4>Podaci novog radnika</h4>
      <dl className="worker-details">
        <div>
          <dt>Ime</dt>
          <dd>{firstName}</dd>
        </div>
        <div>
          <dt>Prezime</dt>
          <dd>{lastName || "—"}</dd>
        </div>
        <div>
          <dt>Prijava (mobilna)</dt>
          <dd>{created.login_name}</dd>
        </div>
        <div>
          <dt>Lozinka</dt>
          <dd className="password-reveal">
            <span>{visible ? created.password : "••••••••"}</span>
            <button
              aria-label={visible ? "Sakrij lozinku" : "Prikazi lozinku"}
              className="password-toggle-inline"
              onClick={() => setVisible((current) => !current)}
              type="button"
            >
              {visible ? "Sakrij" : "Prikazi"}
            </button>
          </dd>
        </div>
      </dl>
      <p className="muted worker-created-note">
        Sacuvajte ove podatke. Postojeca lozinka se ne moze ponovo prikazati iz baze.
      </p>
    </div>
  );
}

function WorkerDetailsForm({ worker }: { worker: WorkerRow }) {
  const { firstName, lastName } = splitFullName(worker.full_name);

  return (
    <form
      action={updateWorkerAction}
      className="worker-edit-form"
      onSubmit={(event) => {
        const form = event.currentTarget;
        const first = (form.elements.namedItem("first_name") as HTMLInputElement).value;
        const last = (form.elements.namedItem("last_name") as HTMLInputElement).value;
        const fullNameInput = form.elements.namedItem("full_name") as HTMLInputElement;
        fullNameInput.value = joinFullName(first, last);
      }}
    >
      <input name="id" type="hidden" value={worker.id} />
      <input name="full_name" type="hidden" defaultValue={worker.full_name} />
      <div className="worker-edit-grid">
        <div className="field">
          <label htmlFor={`first-name-${worker.id}`}>Ime</label>
          <input
            defaultValue={firstName}
            id={`first-name-${worker.id}`}
            name="first_name"
            required
            minLength={1}
          />
        </div>
        <div className="field">
          <label htmlFor={`last-name-${worker.id}`}>Prezime</label>
          <input defaultValue={lastName} id={`last-name-${worker.id}`} name="last_name" />
        </div>
        <div className="field">
          <label htmlFor={`login-name-${worker.id}`}>Prijava (mobilna)</label>
          <input disabled id={`login-name-${worker.id}`} readOnly value={worker.login_name ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={`password-${worker.id}`}>Nova lozinka</label>
          <PasswordField
            id={`password-${worker.id}`}
            name="password"
            placeholder="Ostavite prazno ako se ne menja"
          />
        </div>
      </div>
      <p className="muted worker-edit-note">
        Lozinka se menja samo ako unesete novu. Stara lozinka se ne moze prikazati.
      </p>
      <button className="button" type="submit">
        {sr.common.save}
      </button>
    </form>
  );
}

export function WorkersManager({ workers }: WorkersManagerProps) {
  const [createState, createFormAction, createPending] = useActionState(createWorkerAction, initialCreateState);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  return (
    <section className="grid grid-2">
      <article className="card">
        <h3>{sr.admin.createWorker}</h3>
        <form action={createFormAction} className="form">
          <div className="field">
            <label htmlFor="first_name">Ime</label>
            <input
              id="first_name"
              name="first_name_display"
              onChange={(event) => setFirstName(event.target.value)}
              required
              value={firstName}
            />
          </div>
          <div className="field">
            <label htmlFor="last_name">Prezime</label>
            <input
              id="last_name"
              name="last_name_display"
              onChange={(event) => setLastName(event.target.value)}
              value={lastName}
            />
          </div>
          <input name="full_name" type="hidden" value={joinFullName(firstName, lastName)} />
          <div className="field">
            <label htmlFor="create-password">{sr.auth.password}</label>
            <PasswordField id="create-password" minLength={8} name="password" required />
          </div>
          {createState.error ? <p className="form-error">{createState.error}</p> : null}
          {createState.success ? <p className="form-success">{createState.success}</p> : null}
          <button className="button" disabled={createPending} type="submit">
            {createPending ? sr.common.loading : sr.common.add}
          </button>
        </form>
        {createState.created ? <CreatedWorkerDetails created={createState.created} /> : null}
      </article>

      <article className="card">
        <h3>Radnici</h3>
        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>Ime</th>
                <th>Status</th>
                <th>Kreiran</th>
                <th>Akcija</th>
              </tr>
            </thead>
            <tbody>
            {workers.map((worker) => {
              const { firstName: workerFirstName, lastName: workerLastName } = splitFullName(worker.full_name);
              const isExpanded = expandedId === worker.id;

              return (
                <Fragment key={worker.id}>
                  <tr>
                    <td>
                      <div>{worker.full_name}</div>
                      <div className="muted table-subtext">
                        {workerFirstName}
                        {workerLastName ? ` · ${workerLastName}` : ""}
                      </div>
                    </td>
                    <td>
                      <span className={worker.active ? "badge" : "badge badge-inactive"}>
                        {worker.active ? sr.common.active : sr.common.inactive}
                      </span>
                    </td>
                    <td>{new Date(worker.created_at).toLocaleDateString("sr-RS")}</td>
                    <td className="actions-cell">
                      <button
                        className="button button-secondary"
                        onClick={() => setExpandedId(isExpanded ? null : worker.id)}
                        type="button"
                      >
                        {isExpanded ? "Zatvori" : "Detalji"}
                      </button>
                      <form action={setWorkerActiveAction}>
                        <input name="id" type="hidden" value={worker.id} />
                        <input name="active" type="hidden" value={worker.active ? "false" : "true"} />
                        <button className="button" type="submit">
                          {worker.active ? "Deaktiviraj" : "Aktiviraj"}
                        </button>
                      </form>
                      <form action={deleteWorkerAction}>
                        <input name="id" type="hidden" value={worker.id} />
                        <button className="button button-danger" type="submit">
                          {sr.common.delete}
                        </button>
                      </form>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr>
                      <td colSpan={4}>
                        <WorkerDetailsForm worker={worker} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {workers.length === 0 ? (
              <tr>
                <td colSpan={4}>{sr.common.empty}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </TableWrap>
      </article>
    </section>
  );
}
