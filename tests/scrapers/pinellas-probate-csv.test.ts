import { describe, it, expect } from "vitest";
import {
  parseProbateCsvRow,
  parsePinellasProbateCsv,
  toProbateCaseInput,
  parseDate,
  PINELLAS_PROBATE,
} from "@/lib/scrapers/vendors/pinellas-probate-csv";

// Real header + rows pulled live from
// publicfiles.mypinellasclerk.gov/.../EstateNewCaseFilingsDaily_06-11-2026.csv
// on 2026-06-13 (the ROOTH & ROOTH row is the unquoted-embedded-comma case).
const HEADER =
  "Case Category,Case Type,Case Number,Title,Case Create Date,Decedent's First Name,Decedent's Middle Name,Decedent's Last Name,Decedent's Date of Birth,Decedent's Date of Death,Rep or Petitioner Type,Rep or Petitioner First Name,Rep or Petitioner's Middle Name,Rep or Petitioner's Last Name,Rep or Petitioner Attorney's First Name,Rep or Petitioner Attorney's Middle Name,Rep or Petitioner Attorney 's Last Name,Rep or Petitioner Attorney's Address,Uniform Case Number";

const ROW_CLEAN =
  "PR,FORMAL ADMINISTRATION,26-005781-ES,IN RE: THE ESTATE OF  WILLIE MAE ADAMS,06/11/2026,WILLIE,MAE,ADAMS,,05/03/2026,PETITIONER,DANIEL,,YINGST,JAMES,W,O'NEILL ESQ,2120  52ND STREET S    GULFPORT FL 33707,522026CP005781XXESPR";

const ROW_COMMA_ADDR =
  "PR,SUMMARY ADMINISTRATION UNDER $1000,26-005783-ES,IN RE: THE ESTATE OF MATTHEW RAYMOND POWELL,06/11/2026,MATTHEW,RAYMOND,POWELL,,05/12/2026,PETITIONER,DYLAN,CHRISTOPHER,POWELL,MARIE,R,ZORRILLA,ROOTH & ROOTH, P.A. 7600 SEMINOLE BLVD, STE 102   SEMINOLE FL 33772,522026CP005783XXESPR";

describe("parseProbateCsvRow", () => {
  it("parses a clean 19-column row", () => {
    const r = parseProbateCsvRow(ROW_CLEAN)!;
    expect(r).not.toBeNull();
    expect(r.caseCategory).toBe("PR");
    expect(r.caseType).toBe("FORMAL ADMINISTRATION");
    expect(r.caseNumber).toBe("26-005781-ES");
    expect(r.caseCreateDate).toBe("06/11/2026");
    expect(r.decedentFirst).toBe("WILLIE");
    expect(r.decedentMiddle).toBe("MAE");
    expect(r.decedentLast).toBe("ADAMS");
    expect(r.dateOfDeath).toBe("05/03/2026");
    expect(r.repLast).toBe("YINGST");
    expect(r.attorneyAddress).toBe("2120  52ND STREET S    GULFPORT FL 33707");
    expect(r.uniformCaseNumber).toBe("522026CP005781XXESPR");
  });

  it("handles unquoted embedded commas in the attorney address (the real quirk)", () => {
    const r = parseProbateCsvRow(ROW_COMMA_ADDR)!;
    expect(r).not.toBeNull();
    // Columns BEFORE the address must stay aligned despite the address commas.
    expect(r.caseNumber).toBe("26-005783-ES");
    expect(r.decedentLast).toBe("POWELL");
    expect(r.dateOfDeath).toBe("05/12/2026");
    expect(r.repFirst).toBe("DYLAN");
    expect(r.attorneyLast).toBe("ZORRILLA");
    // The address itself is reassembled with its internal commas.
    expect(r.attorneyAddress).toBe(
      "ROOTH & ROOTH, P.A. 7600 SEMINOLE BLVD, STE 102   SEMINOLE FL 33772",
    );
    // And the rigid right anchor is intact.
    expect(r.uniformCaseNumber).toBe("522026CP005783XXESPR");
  });

  it("stays aligned when the TITLE contains a comma (anchors on first date)", () => {
    const line =
      "PR,FORMAL ADMINISTRATION,26-000099-ES,IN RE: ESTATE OF SMITH, JOHN Q,06/01/2026,JOHN,Q,SMITH,,05/01/2026,PETITIONER,JANE,,SMITH,BOB,,LAW,123 MAIN ST CLEARWATER FL 33755,522026CP000099XXESPR";
    const r = parseProbateCsvRow(line)!;
    expect(r.caseNumber).toBe("26-000099-ES");
    expect(r.title).toBe("IN RE: ESTATE OF SMITH, JOHN Q");
    expect(r.caseCreateDate).toBe("06/01/2026");
    expect(r.decedentFirst).toBe("JOHN");
    expect(r.decedentLast).toBe("SMITH");
    expect(r.attorneyAddress).toBe("123 MAIN ST CLEARWATER FL 33755");
    expect(r.uniformCaseNumber).toBe("522026CP000099XXESPR");
  });

  it("rejects a row shifted by a comma in the decedent name (no corrupted attorney/DoD)", () => {
    // Decedent last name "SMITH, JR" carries an unquoted comma, shifting every
    // column right by one — "JR" lands in the DOB slot. Pre-guard this silently
    // produced a wrong attorney name + lost Date of Death; now it must reject.
    const shifted =
      "PR,FORMAL ADMINISTRATION,26-000200-ES,IN RE: THE ESTATE OF JOHN SMITH,06/01/2026,JOHN,Q,SMITH, JR,03/01/1950,05/01/2026,PETITIONER,JANE,,DOE,BOB,,LAW,123 MAIN ST FL,522026CP000200XXESPR";
    expect(parseProbateCsvRow(shifted)).toBeNull();
  });

  it("rejects the header row and blanks", () => {
    expect(parseProbateCsvRow(HEADER)).toBeNull();
    expect(parseProbateCsvRow("")).toBeNull();
    expect(parseProbateCsvRow("   ")).toBeNull();
  });

  it("rejects short / malformed rows instead of corrupting", () => {
    expect(parseProbateCsvRow("PR,FORMAL ADMINISTRATION,26-1-ES,too,few,cols")).toBeNull();
  });

  it("strips a UTF-8 BOM on the first line", () => {
    const r = parseProbateCsvRow("﻿" + ROW_CLEAN);
    expect(r?.caseNumber).toBe("26-005781-ES");
  });
});

describe("parsePinellasProbateCsv", () => {
  it("parses a full file, skipping the header", () => {
    const file = [HEADER, ROW_CLEAN, ROW_COMMA_ADDR, ""].join("\r\n");
    const rows = parsePinellasProbateCsv(file);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.caseNumber)).toEqual(["26-005781-ES", "26-005783-ES"]);
  });
});

describe("toProbateCaseInput", () => {
  it("assembles decedentName as LAST, FIRST MIDDLE and joins the PR name", () => {
    const input = toProbateCaseInput(parseProbateCsvRow(ROW_CLEAN)!);
    expect(input.caseNumber).toBe("26-005781-ES");
    expect(input.decedentName).toBe("ADAMS, WILLIE MAE");
    expect(input.personalRepresentative).toBe("DANIEL YINGST");
    expect(input.caseTypeRaw).toBe("FORMAL ADMINISTRATION");
    expect(input.filedAt).toBe("06/11/2026");
    // Decedent vitals + petitioner's counsel now flow through (raw MM/DD/YYYY).
    expect(input.dob).toBe(""); // DOB column is empty in this row
    expect(input.dateOfDeath).toBe("05/03/2026");
    expect(input.attorneyName).toBe("JAMES W O'NEILL ESQ");
    expect(input.attorneyAddress).toBe("2120  52ND STREET S    GULFPORT FL 33707");
  });

  it("maps the attorney name/address + date-of-death from the embedded-comma row", () => {
    const input = toProbateCaseInput(parseProbateCsvRow(ROW_COMMA_ADDR)!);
    expect(input.caseNumber).toBe("26-005783-ES");
    expect(input.dateOfDeath).toBe("05/12/2026");
    expect(input.attorneyName).toBe("MARIE R ZORRILLA");
    expect(input.attorneyAddress).toBe(
      "ROOTH & ROOTH, P.A. 7600 SEMINOLE BLVD, STE 102   SEMINOLE FL 33772",
    );
  });

  it("falls back to the Title when structured decedent columns are empty", () => {
    const line =
      "PR,FORMAL ADMINISTRATION,26-000100-ES,IN RE: THE ESTATE OF ACME HOLDINGS,06/01/2026,,,,,,PETITIONER,,,,,,,,522026CP000100XXESPR";
    const input = toProbateCaseInput(parseProbateCsvRow(line)!);
    expect(input.decedentName).toBe("ACME HOLDINGS");
    expect(input.personalRepresentative).toBeNull();
    // Empty optional columns map to ""/null rather than partial junk.
    expect(input.dob).toBe("");
    expect(input.dateOfDeath).toBe("");
    expect(input.attorneyName).toBeNull();
    expect(input.attorneyAddress).toBeNull();
  });
});

describe("parseDate (UTC-safe MM/DD/YYYY)", () => {
  it("parses MM/DD/YYYY to UTC midnight regardless of runner timezone", () => {
    expect(parseDate("06/11/2026")?.toISOString()).toBe("2026-06-11T00:00:00.000Z");
    expect(parseDate("12/31/2026")?.toISOString()).toBe("2026-12-31T00:00:00.000Z");
    expect(parseDate("1/5/2026")?.toISOString()).toBe("2026-01-05T00:00:00.000Z");
  });
  it("returns null for empty/garbage", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate("not a date")).toBeNull();
  });
});

describe("PINELLAS_PROBATE config", () => {
  it("builds the zero-padded MM-DD-YYYY filename URL", () => {
    const d = new Date(Date.UTC(2026, 5, 1, 12)); // June 1 2026
    expect(PINELLAS_PROBATE.fileName(d)).toBe("EstateNewCaseFilingsDaily_06-01-2026.csv");
    expect(PINELLAS_PROBATE.fileUrl(d)).toBe(
      "https://publicfiles.mypinellasclerk.gov/download/PROBATE/NEW_ESTATE_CASE_FILINGS_DAILY/EstateNewCaseFilingsDaily_06-01-2026.csv",
    );
  });
});
