"use client";

import { X } from "lucide-react";
import { usePreferences } from "@/lib/preferences-context";

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  const { lang } = usePreferences();
  const ms = lang === "ms";

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col border border-[var(--ink)] bg-[var(--bg)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--rule)] px-6 py-4">
          <div>
            <div className="rams-kicker">MI4, INC. · kdmirah lab</div>
            <h2
              id="about-modal-title"
              className="mt-1 text-base font-bold text-[var(--ink)]"
            >
              {ms
                ? "Mengenai BillClarity · Detektif Bil Telekom"
                : "About BillClarity · Telecom Bill Detective"}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
              {ms
                ? "Untuk siapa, masalah yang diselesaikan, dan prinsip data"
                : "Who it is for, what problem it solves, and data principles"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rams-btn px-2 py-1.5"
            aria-label="Close guide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6 text-sm text-[var(--ink-soft)]">
          {/* Studio Attribution */}
          <div className="rams-box-subtle px-4 py-3 text-xs leading-relaxed">
            {ms ? (
              <>
                Dibangunkan oleh{" "}
                <strong className="text-[var(--ink)]">
                  MI4, INC. · kdmirah lab
                </strong>{" "}
                sebagai alat kecerdasan pengguna dwibahasa (Bahasa Inggeris /
                Bahasa Melayu) untuk ketelusan bil kesambungan.
              </>
            ) : (
              <>
                Built by{" "}
                <strong className="text-[var(--ink)]">
                  MI4, INC. · kdmirah lab
                </strong>{" "}
                as a bilingual (English / Bahasa Melayu) consumer connectivity
                intelligence tool for transparent telecom billing.
              </>
            )}
          </div>

          {/* Two-Column Spec Grid */}
          <div className="rams-box grid grid-cols-1 divide-y divide-[var(--rule)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className="p-4">
              <div className="rams-kicker">01 / USER</div>
              <div className="mt-1 font-bold text-[var(--ink)]">
                {ms ? "Untuk Siapa Alat Ini" : "Who This Tool Is For"}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed">
                {ms ? (
                  <>
                    Pelanggan harian{" "}
                    <strong className="text-[var(--ink)]">
                      mudah alih dan jalur lebar rumah
                    </strong>{" "}
                    yang menerima penyata bulanan telekom, melihat kenaikan
                    mengejut atau singkatan caj yang mengelirukan, dan mahukan
                    kejelasan sebelum menghubungi khidmat pelanggan.
                  </>
                ) : (
                  <>
                    Everyday{" "}
                    <strong className="text-[var(--ink)]">
                      mobile and home broadband customers
                    </strong>{" "}
                    who open a monthly telecom statement, notice an unexpected
                    spike or cryptic abbreviations, and want clarity before
                    calling or chatting with customer support.
                  </>
                )}
              </p>
            </div>

            <div className="p-4">
              <div className="rams-kicker">02 / PROBLEM</div>
              <div className="mt-1 font-bold text-[var(--ink)]">
                {ms ? "Masalah Yang Diselesaikan" : "The Problem It Solves"}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed">
                {ms ? (
                  <>
                    Bil telekom menggabungkan pelan asas, diskaun yang tamat
                    tempoh, caj prorata separa bulan, pas perayauan tidak
                    sengaja, langganan tambahan, dan surcaj syarikat bersama
                    cukai kerajaan—menyukarkan pelanggan mengetahui apa yang
                    berubah dan apa yang perlu ditanya.
                  </>
                ) : (
                  <>
                    Telecom bills mix base plans, expired discounts, prorated
                    partial-month fees, accidental roaming passes, optional
                    add-ons, and carrier-set recovery surcharges alongside
                    mandated taxes—making it hard to know what changed and what
                    to ask support.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* 3-Step Workflow */}
          <div className="rams-box p-4">
            <div className="rams-kicker">03 / WORKFLOW</div>
            <div className="mt-1 font-bold text-[var(--ink)]">
              {ms
                ? "Cara Menggunakan BillClarity (Aliran 3 Langkah)"
                : "How to Use BillClarity (3-Step Workflow)"}
            </div>
            <ol className="mt-3 space-y-2.5 text-xs leading-relaxed">
              <li className="flex gap-3">
                <span className="font-mono font-bold text-[var(--ink)]">
                  01
                </span>
                <span>
                  {ms ? (
                    <>
                      <strong className="text-[var(--ink)]">
                        Muatkan bil:
                      </strong>{" "}
                      Terokai salah satu daripada tiga senario simulasi di
                      sebelah kiri, atau klik{" "}
                      <strong className="text-[var(--ink)]">
                        + Analisis Bil Saya
                      </strong>{" "}
                      untuk menampal teks bil atau memasukkan item baris secara
                      manual.
                    </>
                  ) : (
                    <>
                      <strong className="text-[var(--ink)]">
                        Load a bill:
                      </strong>{" "}
                      Explore one of the three simulated scenarios on the left,
                      or click{" "}
                      <strong className="text-[var(--ink)]">
                        + Analyze My Bill
                      </strong>{" "}
                      to paste raw lines from your own bill or enter line items
                      manually.
                    </>
                  )}
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono font-bold text-[var(--ink)]">
                  02
                </span>
                <span>
                  {ms ? (
                    <>
                      <strong className="text-[var(--ink)]">
                        Audit caj dalam bahasa mudah:
                      </strong>{" "}
                      Semak penerangan setiap caj, asingkan surcaj syarikat
                      daripada cukai kerajaan, sahkan kiraan separa bulan dalam
                      tab{" "}
                      <strong className="text-[var(--ink)]">
                        Semakan Prorata
                      </strong>
                      , dan pilih item untuk ditanya.
                    </>
                  ) : (
                    <>
                      <strong className="text-[var(--ink)]">
                        Audit charges in plain language:
                      </strong>{" "}
                      Review decoded charge explanations, separate carrier
                      surcharges from government taxes, verify partial-month
                      math in the{" "}
                      <strong className="text-[var(--ink)]">
                        Proration Check
                      </strong>{" "}
                      tab, and toggle which items you want to ask about.
                    </>
                  )}
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono font-bold text-[var(--ink)]">
                  03
                </span>
                <span>
                  {ms ? (
                    <>
                      <strong className="text-[var(--ink)]">
                        Gunakan Ringkasan Persediaan Sokongan semasa panggilan
                        atau sembang:
                      </strong>{" "}
                      Salin, muat turun, atau cetak skrip pembukaan dan soalan
                      yang disusun mengikut keutamaan, kemudian rekodkan nombor
                      rujukan kes serta kredit yang dijanjikan.
                    </>
                  ) : (
                    <>
                      <strong className="text-[var(--ink)]">
                        Take your Support Prep Brief into chat or a call:
                      </strong>{" "}
                      Copy, download, or print your tailored opening script and
                      prioritized questions, then log your support reference
                      number and any promised credits in the persisted Outcome
                      Tracker.
                    </>
                  )}
                </span>
              </li>
            </ol>
          </div>

          {/* Data Principles */}
          <div className="rams-box p-4">
            <div className="rams-kicker">04 / INTEGRITY</div>
            <div className="mt-1 font-bold text-[var(--ink)]">
              {ms
                ? "Prinsip Data, Privasi & Ketidakpastian"
                : "Data, Privacy & Uncertainty Principles"}
            </div>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-relaxed">
              <li>
                {ms ? (
                  <>
                    <strong className="text-[var(--ink)]">
                      Sampel sintetik sahaja:
                    </strong>{" "}
                    Senario sampel yang disertakan menggunakan pembekal rekaan
                    sepenuhnya (<em>Northwind Mobile</em>,{" "}
                    <em>Harborline Fibre &amp; Mobile</em>,{" "}
                    <em>Meadowbrook Telecom</em>) dan angka sintetik—tiada
                    jenama syarikat telekom sebenar atau rekod peribadi
                    pelanggan.
                  </>
                ) : (
                  <>
                    <strong className="text-[var(--ink)]">
                      Synthetic samples only:
                    </strong>{" "}
                    Included sample bills use entirely fictional providers (
                    <em>Northwind Mobile</em>,{" "}
                    <em>Harborline Fibre &amp; Mobile</em>,{" "}
                    <em>Meadowbrook Telecom</em>) and synthetic figures—no real
                    provider branding or private customer records.
                  </>
                )}
              </li>
              <li>
                {ms ? (
                  <>
                    <strong className="text-[var(--ink)]">
                      Tiada sambungan akaun syarikat telekom:
                    </strong>{" "}
                    BillClarity (MI4, INC. · kdmirah lab) tidak bersambung ke
                    sistem pengebilan proprietari. Hanya masukkan perihalan caj
                    dan amaun—jangan masukkan nombor akaun, kad pengenalan, atau
                    butiran bank.
                  </>
                ) : (
                  <>
                    <strong className="text-[var(--ink)]">
                      No carrier account connection:
                    </strong>{" "}
                    BillClarity (MI4, INC. · kdmirah lab) does not connect to
                    proprietary telecom billing systems. Only paste charge
                    descriptions and amounts—omit sensitive account numbers,
                    IDs, or payment details.
                  </>
                )}
              </li>
              <li>
                {ms ? (
                  <>
                    <strong className="text-[var(--ink)]">
                      Anggaran pendidikan, bukan jaminan:
                    </strong>{" "}
                    Klasifikasi caj, semakan prorata, dan anggaran amaun boleh
                    laras adalah panduan berasaskan peraturan. Kredit dan
                    pengecualian sebenar tertakluk kepada terma rasmi penyedia
                    anda.
                  </>
                ) : (
                  <>
                    <strong className="text-[var(--ink)]">
                      Educational estimates, not guarantees:
                    </strong>{" "}
                    Charge classifications, proration checks, and estimated
                    adjustable amounts are rule-based guidance. Actual credits,
                    waivers, and taxes depend on your carrier&apos;s official
                    terms and local regulations.
                  </>
                )}
              </li>
              <li>
                {ms ? (
                  <>
                    <strong className="text-[var(--ink)]">
                      Amaun dalam Ringgit Malaysia (RM):
                    </strong>{" "}
                    Setiap angka dipaparkan dalam ringgit tepat seperti yang
                    dimasukkan — tiada penukaran daripada mata wang lain. Harga
                    pelan dan fi dalam sampel hanyalah ilustrasi, bukan tarif
                    sebenar. Baris sampel &ldquo;Service Tax (SST) 6%&rdquo;
                    menggunakan kadar bagi perkhidmatan telekomunikasi yang
                    disiarkan di portal MySST Jabatan Kastam Diraja Malaysia
                    (disemak November 2026); kadar boleh berubah.
                  </>
                ) : (
                  <>
                    <strong className="text-[var(--ink)]">
                      Amounts in Malaysian Ringgit (RM):
                    </strong>{" "}
                    Every figure is shown in ringgit exactly as entered —
                    nothing is converted from another currency. Plan prices and
                    fees in the samples are illustrative, not real tariffs. The
                    sample &ldquo;Service Tax (SST) 6%&rdquo; lines use the rate
                    for telecommunication services published on the Royal
                    Malaysian Customs Department&apos;s MySST portal (checked
                    November 2026); rates can change.
                  </>
                )}
              </li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--rule)] bg-[var(--bg-subtle)] px-6 py-3.5">
          <span className="font-mono text-[11px] font-semibold text-[var(--ink-muted)]">
            MI4, INC. · kdmirah lab
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rams-btn-primary"
          >
            {ms ? "Faham — Kembali ke Ruang Kerja" : "Got It — Back to Workbench"}
          </button>
        </div>
      </div>
    </div>
  );
}
