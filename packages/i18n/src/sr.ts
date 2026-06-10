export const sr = {
  app: {
    name: "ZN Servis",
    tagline: "Evidencija radova i utrosenog materijala"
  },
  auth: {
    email: "Email",
    name: "Ime",
    password: "Lozinka",
    login: "Prijava",
    logout: "Odjava"
  },
  nav: {
    dashboard: "Kontrolna tabla",
    reports: "Izvestaji",
    workers: "Radnici",
    locations: "Lokacije",
    materials: "Materijali"
  },
  report: {
    new: "Novi izvestaj",
    edit: "Izmeni izvestaj",
    date: "Datum rada",
    worker: "Radnik",
    location: "Lokacija",
    materials: "Materijali",
    material: "Materijal",
    quantity: "Kolicina",
    notes: "Napomene",
    myReports: "Moji izvestaji",
    noReports: "Nema izvestaja"
  },
  admin: {
    createWorker: "Dodaj radnika",
    manageLocations: "Upravljanje lokacijama",
    manageMaterials: "Upravljanje materijalima",
    recentReports: "Najnoviji izvestaji"
  },
  material: {
    group: "Grupa",
    subgroup: "Podgrupa",
    unit: "Jedinica",
    active: "Aktivan"
  },
  sync: {
    pending: "Ceka sinhronizaciju",
    syncing: "Sinhronizacija u toku",
    synced: "Sinhronizovano",
    error: "Greska pri sinhronizaciji"
  },
  common: {
    add: "Dodaj",
    delete: "Obrisi",
    save: "Sacuvaj",
    cancel: "Odustani",
    search: "Pretraga",
    filter: "Filter",
    active: "Aktivno",
    inactive: "Neaktivno",
    loading: "Ucitavanje...",
    empty: "Nema podataka",
    edit: "Izmeni",
    clearFilters: "Ocisti filtere"
  }
} as const;

export type SerbianMessages = typeof sr;
