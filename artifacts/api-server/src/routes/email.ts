import { Router, type IRouter } from "express";
import nodemailer from "nodemailer";
import multer from "multer";
import { db, leadsTable } from "@workspace/db";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/* ── SMTP transporter ── */
function createTransport() {
  return nodemailer.createTransport({
    host: process.env["SMTP_HOST"] || "smtp.timeweb.ru",
    port: Number(process.env["SMTP_PORT"] || 465),
    secure: Number(process.env["SMTP_PORT"] || 465) === 465,
    auth: {
      user: process.env["SMTP_USER"] || "sales@debryansk-auto.ru",
      pass: process.env["SMTP_PASS"],
    },
    tls: { rejectUnauthorized: false },
  });
}

const BLUE = "#0070b8";
const DARK = "#1a2332";
const TO   = process.env["SMTP_TO"] || "sales@debryansk-auto.ru";
const FROM = `"Дебрянск Авто — Сайт" <${process.env["SMTP_USER"] || "sales@debryansk-auto.ru"}>`;

const LOGO_B64 = "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMjcuMzQgNTQuNDgiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iNzIuMzMiIHkxPSIyOC43NSIgeDI9IjMyNy4yIiB5Mj0iMjguNzUiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMDA3MGI4Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzg3YjYzYyIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHBhdGggZD0iTTU0LjQ2LDI2LjMzQzUzLjk2LDExLjI5LDQxLjM2LS40OSwyNi4zMy4wMiwxMS4yOS41Mi0uNDksMTMuMTIuMDIsMjguMTVjLjE1LDQuNDYsMS4zNiw4LjYzLDMuMzksMTIuMjhsNC40OS03LjA2Yy0uNTUtMS43My0uODctMy41Ni0uOTQtNS40Ni0uMzgtMTEuMiw4LjQtMjAuNTgsMTkuNi0yMC45NiwxMS4yLS4zOCwyMC41OCw4LjQsMjAuOTYsMTkuNi4zOCwxMS4yLTguNCwyMC41OC0xOS42LDIwLjk2LTIuMjQuMDgtNC40LS4yMy02LjQzLS44M2wuMDktLjA5LDEwLjY4LTI5LjA5LTEuMjEuMDRzLTE5LjMsMzAuMjMtMTkuNTYsMzEuMDljMCwwLDEuMDQsMS4wOSwyLjA1LDEuODUsMS4wNC43OCwyLjM4LDEuNTQsMi4zOCwxLjU0LDMuNzIsMS43LDcuODcsMi41OSwxMi4yNCwyLjQ0LDE1LjA0LS41LDI2LjgxLTEzLjEsMjYuMzEtMjguMTRaIiBmaWxsPSIjZmZmIi8+CiAgPGcgZmlsbD0iI2ZmZiI+CiAgICA8cGF0aCBkPSJNOTMuMjQsMi44OWgtMTIuNDZjLS43NSwwLTEuNDYuMTYtMi4xMi40Ny0uNjQuMzEtMS4yMS43Mi0xLjY5LDEuMjMtLjQ3LjUxLS44NSwxLjEtMS4xMiwxLjc3LS4yNy42Ny0uNDEsMS4zOC0uNDEsMi4xM3Y5LjM5aC0yLjM3djMuN2gyMi41NnYtMy43aC0yLjM3VjIuODlaTTc5LjAxLDE3Ljg4di05LjM5YzAtLjU0LjE3LS45OS41Mi0xLjM2LjM0LS4zNi43NS0uNTQsMS4yNS0uNTRoOC44OXYxMS4yOWgtMTAuNjZaIi8+CiAgICA8cG9seWdvbiBwb2ludHM9Ijk3Ljk4LDIxLjU4IDExNS43OSwyMS41OCAxMTUuNzksMTcuODggMTAxLjU1LDE3Ljg4IDEwMS41NSwxNC4wOCAxMTMuNDEsMTQuMDggMTEzLjQxLDEwLjM5IDEwMS41NSwxMC4zOSAxMDEuNTUsNi41OSAxMTUuNzksNi41OSAxMTUuNzksMi44OSA5Ny45OCwyLjg5Ii8+CiAgICA8cGF0aCBkPSJNMTM2LjIsMTIuOTZjLS4yOS0uNjctLjY3LTEuMjYtMS4xNS0xLjc2LS40OC0uNS0xLjA0LS45MS0xLjY4LTEuMTktLjY1LS4yOS0xLjM0LS40NC0yLjA1LS40NGgtOC44OXYtMi45N2gxMS44NnYtMy43aC0xNS40NHYxOC42OGgxMi40NmMuNzUsMCwxLjQ2LS4xNiwyLjEyLS40Ny42NC0uMzEsMS4yMS0uNzIsMS42OS0xLjIzLjQ3LS41MS44NS0xLjEsMS4xMi0xLjc3LjI3LS42Ny40MS0xLjM4LjQxLTIuMTN2LS44NGMtLjAyLS43Ny0uMTctMS41MS0uNDYtMi4xOFpNMTIyLjQzLDEzLjI2aDguODljLjUsMCwuOTEuMTgsMS4yNS41NC4zNS4zNy41Mi44MS41MiwxLjM2di44MmMwLC41NC0uMTcuOTktLjUyLDEuMzYtLjM0LjM2LS43NS41NC0xLjI1LjU0aC04Ljg5di00LjYyWiIvPgogICAgPHBhdGggZD0iTTE1Ny4wOCw2LjI5Yy0uMjktLjY3LS42Ny0xLjI2LTEuMTUtMS43Ni0uNDgtLjUtMS4wNC0uOTEtMS42OC0xLjE5LS42NS0uMjktMS4zNC0uNDQtMi4wNS0uNDRoLTEyLjQ2djE4LjY4aDMuNTd2LTVoOC44OWMuNzUsMCwxLjQ2LS4xNiwyLjEyLS40Ny42NC0uMzEsMS4yMS0uNzIsMS42OS0xLjIzLjQ3LS41MS44NS0xLjEsMS4xMi0xLjc3LjI3LS42Ny40MS0xLjM4LjQxLTIuMTN2LTIuNTFjLS4wMi0uNzctLjE3LTEuNTEtLjQ2LTIuMThaTTE0My4zMSw2LjU5aDguODljLjUsMCwuOTEuMTgsMS4yNS41NC4zNS4zNy41Mi44Mi41MiwxLjM2djIuNWMwLC41NC0uMTcuOTktLjUyLDEuMzYtLjM0LjM2LS43NS41NC0xLjI1LjU0aC04Ljg5di02LjI5WiIvPgogICAgPHBhdGggZD0iTTE2My44NCwzLjM2Yy0uNjQuMzEtMS4yMS43Mi0xLjY5LDEuMjMtLjQ4LjUxLS44NSwxLjEtMS4xMiwxLjc3LS4yNy42Ny0uNDEsMS4zOC0uNDEsMi4xM3YyLjVjMCwuNjEuMDksMS4yMS4yOCwxLjc3LjE4LjU2LjQ0LDEuMDguNzcsMS41NC4zMy40NS43Mi44NiwxLjE3LDEuMi4yMS4xNi40My4zMS42Ni40M2wtMi44OCwzLjAzdjIuNjFoMi41NGw0Ljc1LTVoNi45NXY1aDMuNTdWMi44OWgtMTIuNDZjLS43NSwwLTEuNDYuMTYtMi4xMi40N1pNMTc0Ljg1LDYuNTl2Ni4yOWgtOC44OWMtLjUsMC0uOTEtLjE4LTEuMjUtLjU0LS4zNS0uMzctLjUyLS44MS0uNTItMS4zNnYtMi41YzAtLjU0LjE3LS45OS41Mi0xLjM2LjM0LS4zNi43NS0uNTQsMS4yNS0uNTRoOC44OVoiLz4KICAgIDxwb2x5Z29uIHBvaW50cz0iMTk2LjIxLDEwLjM5IDE4NS41NSwxMC4zOSAxODUuNTUsMi44OSAxODEuOTcsMi44OSAxODEuOTcsMjEuNTggMTg1LjU1LDIxLjU4IDE4NS41NSwxNC4wOCAxOTYuMjEsMTQuMDggMTk2LjIxLDIxLjU4IDE5OS43OCwyMS41OCAxOTkuNzgsMi44OSAxOTYuMjEsMi44OSIvPgogICAgPHBhdGggZD0iTTIyMC45MSw5LjA5di0uNjFjLS4wMy0uNzctLjE5LTEuNTEtLjQ4LTIuMTgtLjI5LS42Ny0uNjctMS4yNi0xLjE1LTEuNzYtLjQ4LS41LTEuMDQtLjkxLTEuNjgtMS4xOS0uNjUtLjI5LTEuMzMtLjQ0LTIuMDUtLjQ0aC03LjEzYy0uNzUuMDItMS40Ni4xOS0yLjExLjUtLjY0LjMtMS4yMS43MS0xLjY4LDEuMjItLjQ4LjUtLjg2LDEuMDktMS4xMywxLjc2LS4yNy42Ny0uNDEsMS4zOC0uNDEsMi4xM3Y3LjQ5YzAsLjc4LjE0LDEuNTEuNDMsMi4xOS4yOC42Ny42NywxLjI3LDEuMTUsMS43Ny40OS41LDEuMDYuOSwxLjcxLDEuMTkuNjUuMjksMS4zNC40NCwyLjA2LjQ0aDcuMTJjLjc1LDAsMS40Ni0uMTYsMi4xMi0uNDcuNjUtLjMxLDEuMjEtLjcyLDEuNjktMS4yMy40Ny0uNTEuODUtMS4xLDEuMTMtMS43Ny4yNy0uNjcuNDEtMS4zOC40MS0yLjEzdi0uNmgtMy41N3YuNmMwLC41NC0uMTcuOTktLjUyLDEuMzYtLjM0LjM2LS43NS41NC0xLjI1LjU0aC03LjEyYy0uNSwwLS45MS0uMTgtMS4yNS0uNTQtLjM1LS4zNy0uNTItLjgxLS41Mi0xLjM2di03LjQ5YzAtLjU0LjE3LS45OS41Mi0xLjM2LjM0LS4zNi43NS0uNTQsMS4yNS0uNTRoNy4xMmMuNSwwLC45MS4xOCwxLjI1LjU0LjM1LjM3LjUyLjgyLjUyLDEuMzZ2LjZoMy41OFoiLz4KICAgIDxwb2x5Z29uIHBvaW50cz0iMjM3LjU4LDIuODkgMjMwLjQ2LDEwLjM5IDIyNy41NCwxMC4zOSAyMjcuNTQsMi44OSAyMjMuOTcsMi44OSAyMjMuOTcsMjEuNTggMjI3LjU0LDIxLjU4IDIyNy41NCwxNC4wOCAyMzAuNDYsMTQuMDggMjM3LjU4LDIxLjU4IDI0Mi41OCwyMS41OCAyMzMuNywxMi4yNCAyNDIuNTgsMi44OSIvPgogICAgPHBhdGggZD0iTTI2NS40Niw0LjUzYy0uNDgtLjUtMS4wNC0uOS0xLjY4LTEuMTktLjY1LS4yOS0xLjMzLS40NC0yLjA1LS40NGgtNy4xMmMtLjc1LDAtMS40Ni4xNi0yLjEyLjQ3LS42NC4zMS0xLjIxLjcyLTEuNjksMS4yMy0uNDguNTEtLjg1LDEuMTEtMS4xMiwxLjc3LS4yNy42Ny0uNDEsMS4zOC0uNDEsMi4xM3YxMy4wOWgzLjU3di01aDEwLjY2djVoMy41N3YtMTMuMWMtLjAyLS43Ny0uMTctMS41MS0uNDYtMi4xOC0uMjktLjY3LS42Ny0xLjI2LTEuMTUtMS43NlpNMjYzLjUsOC40OXY0LjRoLTEwLjY2di00LjRjMC0uNTUuMTctLjk5LjUyLTEuMzYuMzQtLjM2Ljc1LS41NCwxLjI1LS41NGg3LjEyYy41LDAsLjkxLjE4LDEuMjUuNTQuMzUuMzcuNTIuODIuNTIsMS4zNloiLz4KICAgIDxwYXRoIGQ9Ik0yODcuOTgsNi4yOWMtLjI5LS42Ny0uNjgtMS4yNi0xLjE2LTEuNzctLjQ5LS41LTEuMDYtLjktMS43LTEuMTktLjY1LS4yOS0xLjM0LS40NC0yLjA0LS40NGgtMTIuNDZ2MTguNjhoMTIuNDhjLjc1LS4wMiwxLjQ1LS4xOSwyLjExLS41LjY0LS4zLDEuMjEtLjcxLDEuNjgtMS4yMS40OC0uNS44NS0xLjA5LDEuMTMtMS43NC4yOC0uNjYuNDEtMS4zOC40MS0yLjE0LDAtMS40NS0uNDYtMi43MS0xLjM4LTMuNzUuOTEtMS4wNCwxLjM4LTIuMjksMS4zOC0zLjc1LDAtLjc4LS4xNS0xLjUyLS40NC0yLjJaTTI3NC4xOSwxNC4wOGg4Ljg5Yy41LDAsLjkxLjE4LDEuMjUuNTQuMzUuMzcuNTIuODIuNTIsMS4zNnMtLjE3Ljk5LS41MiwxLjM2Yy0uMzQuMzYtLjc1LjU0LTEuMjUuNTRoLTguODl2LTMuOFpNMjgzLjA4LDEwLjM5aC04Ljg5di0zLjhoOC44OWMuNSwwLC45MS4xOCwxLjI1LjU0LjM1LjM3LjUyLjgyLjUyLDEuMzZzLS4xNy45OS0uNTIsMS4zNmMtLjM0LjM2LS43NS41NC0xLjI1LjU0WiIvPgogICAgPHBvbHlnb24gcG9pbnRzPSIyOTAuMDcsNi41OSAyOTcuMTksNi41OSAyOTcuMTksMjEuNTggMzAwLjc2LDIxLjU4IDMwMC43Niw2LjU5IDMwNy44OCw2LjU5IDMwNy44OCwyLjg5IDI5MC4wNywyLjg5Ii8+CiAgICA8cGF0aCBkPSJNMzI2LjksNi4zMmMtLjI5LS42Ny0uNjgtMS4yNi0xLjE3LTEuNzctLjQ4LS41LTEuMDUtLjktMS42OC0xLjItLjY1LS4zLTEuMzQtLjQ2LTIuMDYtLjQ2aC03LjEyYy0uNzMsMC0xLjQ0LjE1LTIuMDkuNDYtLjY0LjMtMS4yMS43LTEuNjksMS4yMS0uNDcuNS0uODYsMS4xLTEuMTQsMS43Ny0uMjguNjgtLjQzLDEuNDEtLjQzLDIuMTd2Ny40OWMwLC43OC4xNCwxLjUxLjQxLDIuMTguMjcuNjcuNjUsMS4yNywxLjEzLDEuNzguNDguNSwxLjA1LjkxLDEuNywxLjIuNjUuMjksMS4zNi40NCwyLjExLjQ0aDcuMTJjLjczLDAsMS40My0uMTUsMi4wOS0uNDUuNjQtLjMsMS4yMS0uNywxLjY5LTEuMjEuNDgtLjUuODYtMS4xLDEuMTQtMS43Ny4yOC0uNjguNDMtMS40MS40My0yLjE3di03LjQ5YzAtLjc2LS4xNS0xLjQ5LS40NC0yLjE3Wk0zMjMuNzcsOC40OXY3LjQ5YzAsLjU0LS4xNy45OS0uNTIsMS4zNi0uMzQuMzYtLjc1LjU0LTEuMjUuNTRoLTcuMTJjLS41LDAtLjkxLS4xOC0xLjI1LS41NC0uMzUtLjM3LS41Mi0uODEtLjUyLTEuMzZ2LTcuNDljMC0uNTUuMTctLjk5LjUyLTEuMzYuMzQtLjM2Ljc1LS41NCwxLjI1LS41NGg3LjEyYy41LDAsLjkxLjE4LDEuMjUuNTQuMzUuMzcuNTIuODIuNTIsMS4zNloiLz4KICAgIDxwYXRoIGQ9Ik03NC4xMiw0NC44N3Y2LjcyaC0xLjA2di03Ljg0aDYuMzh2MS4xMmgtNS4zMloiLz4KICAgIDxwYXRoIGQ9Ik05MC42MSw0Ny4xMWMwLC4zLS4wNi41OC0uMTYuODUtLjExLjI3LS4yNi41MS0uNDUuNzEtLjE5LjIxLS40Mi4zNy0uNjguNDktLjI2LjEyLS41NC4xOC0uODMuMThoLTQuMjV2Mi4yNGgtMS4wNnYtNy44NGg1LjMyYy4yOCwwLC41NS4wNi44MS4xNy4yNS4xMi40OC4yNy42Ny40OC4xOS4yLjM1LjQ0LjQ2LjcxLjEyLjI3LjE4LjU3LjE5Ljg4djEuMTJaTTg5LjU0LDQ1Ljk5YzAtLjMxLS4xLS41OC0uMzEtLjc5LS4yMS0uMjItLjQ2LS4zMy0uNzYtLjMzaC00LjI1djMuMzZoNC4yNWMuMywwLC41NS0uMTEuNzYtLjMyLjIxLS4yMi4zMS0uNDguMzEtLjc5di0xLjEyWiIvPgogICAgPHBhdGggZD0iTTk5Ljg2LDUwLjQ3Yy4zLDAsLjU1LS4xMS43NS0uMzMuMjEtLjIyLjMxLS40OC4zMS0uNzl2LTEuMTJoLTQuMjVjLS4yOCwwLS41NS0uMDYtLjgxLS4xNy0uMjYtLjEyLS40OS0uMjctLjY4LS40OC0uMi0uMi0uMzUtLjQ0LS40Ni0uNzEtLjExLS4yNy0uMTctLjU3LS4xNy0uODh2LTIuMjRoMS4wNnYyLjI0YzAsLjMxLjEuNTguMzEuNzkuMjEuMjIuNDYuMzIuNzUuMzJoNC4yNXYtMy4zNmgxLjA2djUuNmMwLC4zLS4wNS41OC0uMTYuODUtLjExLjI3LS4yNi41LS40NS43MS0uMTkuMjEtLjQyLjM3LS42OC40OS0uMjYuMTItLjU0LjE4LS44My4xOGgtMi45OGMtLjI5LDAtLjU2LS4wNi0uODItLjE3LS4yNi0uMTItLjQ4LS4yNy0uNjctLjQ4LS4xOS0uMi0uMzQtLjQ0LS40Ni0uNzEtLjExLS4yNy0uMTctLjU3LS4xOC0uODhoMS4wNmMwLC4zMS4xLjU4LjMxLjc5LjIxLjIyLjQ2LjMzLjc1LjMzaDIuOThaIi8+CiAgICA8cGF0aCBkPSJNMTEzLjY4LDUxLjU5aC0xLjA2di02LjcyaC01LjMydjYuNzJoLTEuMDZ2LTcuODRoNy40NHY3Ljg0WiIvPgogICAgPHBhdGggZD0iTTEyNS4zOCw1MS41OWgtMS4wNnYtNi43MmgtNS4zMnY2LjcyaC0xLjA2di03Ljg0aDcuNDR2Ny44NFoiLz4KICAgIDxwYXRoIGQ9Ik0xMzcuMDgsNTEuNTloLTEuMDZ2LTIuMjRoLTUuMzJ2Mi4yNGgtMS4wNnYtNS42YzAtLjMuMDUtLjU4LjE2LS44NS4xMS0uMjcuMjYtLjUxLjQ1LS43MS4xOS0uMjEuNDItLjM3LjY4LS40OS4yNi0uMTIuNTQtLjE4LjgzLS4xOGgzLjE5Yy4yOCwwLC41NS4wNi44MS4xNy4yNS4xMi40OC4yNy42Ny40OC4xOS4yLjM1LjQ0LjQ2LjcxLjEyLjI3LjE4LjU3LjE5Ljg4djUuNlpNMTMxLjc2LDQ0Ljg3Yy0uMywwLS41NS4xMS0uNzYuMzMtLjIxLjIyLS4zMS40OC0uMzEuNzl2Mi4yNGg1LjMydi0yLjI0YzAtLjMxLS4xLS41OC0uMzEtLjc5LS4yMS0uMjItLjQ2LS4zMy0uNzYtLjMzaC0zLjE5WiIvPgogICAgPHBhdGggZD0iTTE1Mi41LDQ3LjY3bDMuNzIsMy45MmgtMS41bC0zLjE5LTMuMzZoLTEuNjl2My4zNmgtMS4wNnYtNy44NGgxLjA2djMuMzZoMS42OWwzLjE5LTMuMzZoMS41bC0zLjcyLDMuOTJaIi8+CiAgICA8cGF0aCBkPSJNMTY2Ljg1LDQ5LjM1YzAsLjMxLS4wNi42LS4xNy44Ny0uMTEuMjctLjI3LjUxLS40Ni43MS0uMTkuMi0uNDIuMzYtLjY3LjQ4LS4yNi4xMi0uNTMuMTgtLjgyLjE4aC0zLjE5Yy0uMywwLS41OC0uMDYtLjgzLS4xNy0uMjYtLjEyLS40OC0uMjctLjY3LS40OC0uMTktLjItLjM0LS40NC0uNDUtLjcxLS4xMS0uMjctLjE2LS41Ny0uMTYtLjg4di0zLjM2YzAtLjMxLjA2LS42LjE3LS44Ny4xMS0uMjcuMjctLjUxLjQ2LS43MS4xOS0uMi40Mi0uMzYuNjctLjQ4LjI2LS4xMi41My0uMTguODItLjE4aDMuMTljLjI4LDAsLjU1LjA2LjgxLjE4LjI1LjEyLjQ4LjI4LjY3LjQ4LjIuMi4zNS40NC40Ny43MS4xMi4yNy4xOC41Ni4xOC44N3YzLjM2Wk0xNjUuNzksNDUuOTljMC0uMzEtLjEtLjU4LS4zMS0uNzktLjIxLS4yMi0uNDYtLjMzLS43NS0uMzNoLTMuMTljLS4zLDAtLjU1LjExLS43NS4zMy0uMjEuMjItLjMxLjQ4LS4zMS43OXYzLjM2YzAsLjMxLjEuNTguMzEuNzkuMjEuMjIuNDYuMzMuNzUuMzNoMy4xOWMuMywwLC41NS0uMTEuNzUtLjMzLjIxLS4yMi4zMS0uNDguMzEtLjc5di0zLjM2WiIvPgogICAgPHBhdGggZD0iTTE3Mi4wNyw0NS43NXY1LjgzaC0xLjA2di03Ljg0aDEuMDZsMy4xOSw0Ljg1LDMuMTktNC44NWgxLjA2djcuODRoLTEuMDZ2LTUuODNsLTMuMTksNC44NS0zLjE5LTQuODVaIi8+CiAgICA8cGF0aCBkPSJNMTkxLjIxLDUxLjU5aC0xLjA2di02LjcyaC01LjMydjYuNzJoLTEuMDZ2LTcuODRoNy40NHY3Ljg0WiIvPgogICAgPHBhdGggZD0iTTIwMi45LDUxLjU5aC0xLjA2di0yLjI0aC01LjMydjIuMjRoLTEuMDZ2LTUuNmMwLS4zLjA2LS41OC4xNi0uODUuMTEtLjI3LjI2LS41MS40NS0uNzEuMTktLjIxLjQyLS4zNy42OC0uNDkuMjYtLjEyLjU0LS4xOC44My0uMThoMy4xOWMuMjgsMCwuNTUuMDYuODEuMTcuMjUuMTIuNDguMjcuNjcuNDguMTkuMi4zNS40NC40Ni43MS4xMi4yNy4xOC41Ny4xOS44OHY1LjZaTTE5Ny41OSw0NC44N2MtLjMsMC0uNTUuMTEtLjc1LjMzLS4yLjIyLS4zMS40OC0uMzEuNzl2Mi4yNGg1LjMydi0yLjI0YzAtLjMxLS4xLS41OC0uMzEtLjc5LS4yLS4yMi0uNDYtLjMzLS43NS0uMzNoLTMuMTlaIi8+CiAgICA8cGF0aCBkPSJNMjA4LjIyLDQ3LjExaDUuMzJ2LTMuMzZoMS4wNnY3Ljg0aC0xLjA2di0zLjM2aC01LjMydjMuMzZoLTEuMDZ2LTcuODRoMS4wNnYzLjM2WiIvPgogICAgPHBhdGggZD0iTTIxOC44NSw0My43NWgxLjA2djYuMjFsNS4zMi02LjIxaDEuMDZ2Ny44NGgtMS4wNnYtNi4zMmwtNS4zMiw2LjMyaC0xLjA2di03Ljg0WiIvPgogICAgPHBhdGggZD0iTTIzMC41NSw0My43NWgxLjA2djYuMjFsNS4zMi02LjIxaDEuMDZ2Ny44NGgtMS4wNnYtNi4zMmwtNS4zMiw2LjMyaC0xLjA2di03Ljg0Wk0yMzYuNCw0MS41MWMwLC4zLS4wNi41OC0uMTcuODUtLjExLjI3LS4yNi41MS0uNDUuNzFzLS40Mi4zNy0uNjcuNDljLS4yNi4xMi0uNTQuMTgtLjgzLjE4cy0uNTYtLjA2LS44Mi0uMTdjLS4yNS0uMTItLjQ4LS4yNy0uNjctLjQ4LS4xOS0uMi0uMzQtLjQ0LS40Ni0uNzEtLjExLS4yNy0uMTctLjU3LS4xOC0uODhoMS4wNmMwLC4zMS4xLjU4LjMxLjc5LjIxLjIyLjQ2LjMyLjc1LjMycy41NS0uMTEuNzUtLjMyYy4yMS0uMjIuMzEtLjQ4LjMxLS43OWgxLjA2WiIvPgogIDwvZz4KICA8cmVjdCB4PSI3Mi4zMyIgeT0iMjguMyIgd2lkdGg9IjI1NC44NyIgaGVpZ2h0PSIuOTEiIGZpbGw9InVybCgjZykiLz4KPC9zdmc+";

const LOGO_SRC = `data:image/svg+xml;base64,${LOGO_B64}`;

function logoHtml(accent = BLUE) {
  return `
    <table cellpadding="0" cellspacing="0" style="width:100%">
      <tr>
        <td style="vertical-align:middle">
          <img src="${LOGO_SRC}" alt="Дебрянск Авто" width="200" height="33"
               style="display:block;border:0;outline:none;max-width:200px;height:auto" />
          <div style="color:#546e8a;font-size:10px;margin-top:5px;font-family:Arial,sans-serif">
            debryansk-auto.ru &nbsp;·&nbsp; sales@debryansk-auto.ru &nbsp;·&nbsp; +7 (4832) 77 77 70
          </div>
        </td>
        <td style="text-align:right;vertical-align:top">
          <span style="display:inline-block;background:${accent};color:#fff;font-size:10px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:0.5px;font-family:Arial,sans-serif;text-transform:uppercase">
            Новая заявка
          </span>
        </td>
      </tr>
    </table>`;
}

function wrapEmail(body: string, accent = BLUE) {
  const now = new Date().toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#e8eef4;font-family:'Segoe UI',Arial,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;background:#e8eef4;padding:28px 16px">
  <tr><td>
    <table cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 6px 32px rgba(0,0,0,0.13)">
      <!-- HEADER -->
      <tr>
        <td style="background:linear-gradient(135deg,${DARK} 0%,#253447 100%);padding:20px 28px 16px">
          ${logoHtml(accent)}
        </td>
      </tr>
      <!-- BODY -->
      <tr><td style="background:#fff">${body}</td></tr>
      <!-- FOOTER -->
      <tr>
        <td style="background:#f2f5f8;border-top:1px solid #dde3ea;padding:14px 28px">
          <table cellpadding="0" cellspacing="0" style="width:100%"><tr>
            <td style="color:#8fa8c0;font-size:11px;font-family:Arial,sans-serif">
              Дебрянск Авто &nbsp;·&nbsp; г. Брянск &nbsp;·&nbsp; +7 (4832) 77 77 70
            </td>
            <td style="color:#8fa8c0;font-size:11px;text-align:right;font-family:Arial,sans-serif">${now}</td>
          </tr></table>
          <div style="margin-top:5px;color:#b0bec5;font-size:10px;font-family:Arial,sans-serif">
            Это автоматическое уведомление. Все данные заявки содержатся в этом письме.
          </div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function banner(icon: string, label: string, color: string) {
  return `<div style="background:${color}18;border-left:4px solid ${color};margin:20px 28px 0;padding:10px 16px;border-radius:0 8px 8px 0;display:flex;align-items:center;gap:10px;font-family:Arial,sans-serif">
    <span style="font-size:20px">${icon}</span>
    <span style="color:${color};font-weight:700;font-size:14px">${label}</span>
  </div>`;
}

function heading(title: string, sub?: string) {
  return `<div style="padding:14px 28px 0;font-family:Arial,sans-serif">
    <div style="font-weight:800;font-size:16px;color:${DARK}">${title}</div>
    ${sub ? `<div style="color:#64748b;font-size:12px;margin-top:3px">${sub}</div>` : ""}
  </div>`;
}

function dataTable(rows: [string, string | undefined | null][]) {
  const visible = rows.filter(([, v]) => v);
  return `<table cellpadding="0" cellspacing="0" style="width:calc(100% - 56px);margin:14px 28px 0;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;border-collapse:collapse">
    <tbody>
      ${visible.map(([l, v], i) => `
      <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#fff"}">
        <td style="padding:9px 13px;color:#64748b;font-size:11px;font-weight:600;width:37%;border-right:1px solid #e2e8f0;font-family:Arial,sans-serif;vertical-align:top">${l}</td>
        <td style="padding:9px 13px;color:${DARK};font-size:13px;font-family:Arial,sans-serif">${v}</td>
      </tr>`).join("")}
    </tbody>
  </table>`;
}

function carCard(mark: string, model: string, year: string | number, price: string | number, dealer?: string) {
  const priceStr = typeof price === "number" ? price.toLocaleString("ru-RU") + " ₽" : price;
  return `<div style="margin:14px 28px 0;background:linear-gradient(135deg,#f0f7ff,#e8f3fc);border:1px solid ${BLUE}22;border-radius:10px;padding:13px 16px;display:flex;align-items:center;gap:12px;font-family:Arial,sans-serif">
    <div style="width:38px;height:38px;background:${BLUE};border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;text-align:center;line-height:38px">🚗</div>
    <div>
      <div style="font-weight:800;color:${DARK};font-size:15px">${mark} ${model}</div>
      <div style="color:#64748b;font-size:12px;margin-top:1px">${year}${dealer ? " · " + dealer : ""} · ${priceStr}</div>
    </div>
  </div>`;
}

function vacancyCard(title: string, dept: string, dealer: string, salary: string) {
  return `<div style="margin:14px 28px 0;background:linear-gradient(135deg,#faf5ff,#f3e8ff);border:1px solid #c4b5fd;border-radius:10px;padding:13px 16px;font-family:Arial,sans-serif">
    <div style="font-weight:800;color:#4c1d95;font-size:14px">${title}</div>
    <div style="color:#6d28d9;font-size:12px;margin-top:2px">${dept} · ${dealer} · ${salary}</div>
  </div>`;
}

function msgBox(text: string) {
  return `<div style="margin:14px 28px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:13px 15px;font-family:Arial,sans-serif">
    <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">Текст сообщения</div>
    <div style="color:${DARK};font-size:13px;line-height:1.65">${text}</div>
  </div>`;
}

function actionBlock(phone: string, email?: string, label = "Связаться с клиентом", accent = BLUE) {
  return `<div style="margin:18px 28px 24px;background:${accent}0d;border:1px solid ${accent}25;border-radius:12px;padding:16px 20px;font-family:Arial,sans-serif">
    <div style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">${label}</div>
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:8px">
        <div style="background:${accent};color:#fff;padding:10px 18px;border-radius:9px;font-weight:700;font-size:14px;font-family:Arial,sans-serif">
          📞 ${phone}
        </div>
      </td>
      ${email ? `<td>
        <div style="background:#fff;color:${accent};border:1.5px solid ${accent};padding:10px 18px;border-radius:9px;font-weight:700;font-size:13px;font-family:Arial,sans-serif">
          ✉️ ${email}
        </div>
      </td>` : ""}
    </tr></table>
  </div>`;
}

function hr() {
  return `<div style="height:1px;background:#e8edf2;margin:18px 28px 0"></div>`;
}

/* ── HTML builders for each form ── */

function buildCallbackHtml(d: Record<string, string>) {
  return wrapEmail(
    banner("📞", "Заказать звонок — сайт Дебрянск Авто", BLUE) +
    heading("Клиент ждёт звонка", "Заявка оставлена через кнопку «Заказать звонок» в шапке сайта") +
    dataTable([
      ["Имя клиента",     d.name],
      ["Телефон",         d.phone],
      ["Дата / время",    new Date().toLocaleString("ru-RU")],
    ]) +
    hr() +
    actionBlock(d.phone, undefined, "Перезвонить клиенту", BLUE),
    BLUE
  );
}

function buildTestDriveHtml(d: Record<string, string>) {
  const accent = BLUE;
  return wrapEmail(
    banner("🏁", "Запись на тест-драйв", accent) +
    heading("Новая запись на тест-драйв", "Клиент выбрал автомобиль и хочет приехать") +
    (d.carMark ? carCard(d.carMark, d.carModel || "", d.carYear || "", d.carPrice || "", d.dealer) : "") +
    dataTable([
      ["Имя клиента",     d.name],
      ["Телефон",         d.phone],
      ["Желаемая дата",   d.preferredDate],
      ["Желаемое время",  d.preferredTime],
      ["Дилерский центр", d.dealer],
      ["Комментарий",     d.comment],
    ]) +
    hr() +
    actionBlock(d.phone, undefined, "Подтвердить запись и позвонить клиенту", accent),
    accent
  );
}

function buildCreditHtml(d: Record<string, string>) {
  const accent = "#059669";
  return wrapEmail(
    banner("💳", "Заявка на автокредит", accent) +
    heading("Заявка на кредит", "Клиент рассчитал кредит и оставил заявку") +
    (d.carMark ? carCard(d.carMark, d.carModel || "", d.carYear || "", d.carPrice || "", d.dealer) : "") +
    dataTable([
      ["Имя клиента",          d.name],
      ["Телефон",              d.phone],
      ["Стоимость авто",       d.carPrice ? Number(d.carPrice).toLocaleString("ru-RU") + " ₽" : undefined],
      ["Первоначальный взнос", d.downPayment],
      ["Срок кредита",         d.term ? d.term + " мес." : undefined],
      ["Ежемесячный платёж",   d.monthlyPayment],
      ["Итоговая сумма",       d.totalAmount],
      ["Дилерский центр",      d.dealer],
    ]) +
    hr() +
    actionBlock(d.phone, undefined, "Проконсультировать клиента по кредиту", accent),
    accent
  );
}

function buildTradeInHtml(d: Record<string, string>) {
  const accent = "#d97706";
  const targetSection = d.targetMark
    ? `<div style="padding:14px 28px 4px;font-family:Arial,sans-serif">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.6px">Планирует купить взамен</div>
      </div>` +
      carCard(
        d.targetMark,
        d.targetModel || "",
        d.targetIsNew === "да" ? "Новый автомобиль" : (d.targetYear || ""),
        d.targetPrice ? Number(d.targetPrice) : "уточнить цену"
      )
    : "";
  return wrapEmail(
    banner("🔄", "Заявка на Trade-in", accent) +
    heading("Trade-in: клиент хочет обменять автомобиль", "Клиент оставил данные своего авто для оценки") +
    dataTable([
      ["Имя клиента",    d.name],
      ["Телефон",        d.phone],
      ["Марка / Модель", d.brand && d.model ? `${d.brand} ${d.model}` : (d.brand || d.model)],
      ["Год выпуска",    d.year],
      ["Пробег",         d.mileage ? Number(d.mileage).toLocaleString("ru-RU") + " км" : undefined],
      ["Состояние",      d.condition],
      ["Владельцев",     d.owners],
      ["Онлайн-оценка",  d.estimateMin && d.estimateMax ? `${Number(d.estimateMin).toLocaleString("ru-RU")} — ${Number(d.estimateMax).toLocaleString("ru-RU")} ₽` : d.estimate],
      ["Комментарий",    d.comment],
    ]) +
    targetSection +
    hr() +
    actionBlock(d.phone, undefined, "Связаться и уточнить оценку", accent),
    accent
  );
}

function buildVacancyHtml(d: Record<string, string>) {
  const accent = "#7c3aed";
  return wrapEmail(
    banner("💼", "Отклик на вакансию", accent) +
    heading("Новый кандидат", "Кандидат откликнулся через страницу Вакансии") +
    (d.vacancyTitle ? vacancyCard(d.vacancyTitle, d.dept || "", d.dealer || "", d.salary || "") : "") +
    dataTable([
      ["Имя кандидата",      d.name],
      ["Телефон",            d.phone],
      ["Отдел",              d.dept],
      ["Дилерский центр",    d.dealer],
      ["Ожидаемая зарплата", d.salary],
    ]) +
    hr() +
    actionBlock(d.phone, undefined, "Связаться с кандидатом", accent),
    accent
  );
}

function buildOpenResumeHtml(d: Record<string, string>) {
  const accent = "#0f766e";
  return wrapEmail(
    banner("📋", "Открытый отклик — кандидат в резерв", accent) +
    heading("Кандидат в кадровый резерв", "Не нашёл подходящей вакансии, но хочет работать в компании") +
    dataTable([
      ["Имя кандидата", d.name],
      ["Телефон",       d.phone],
    ]) +
    `<div style="margin:12px 28px 0;background:#f0fdf4;border-radius:8px;padding:9px 13px;font-size:12px;color:#166534;font-family:Arial,sans-serif">
      💡 Добавьте кандидата в базу для будущих открытых позиций
    </div>` +
    hr() +
    actionBlock(d.phone, undefined, "Связаться с кандидатом", accent),
    accent
  );
}

function buildBuyoutHtml(d: Record<string, string>) {
  const GREEN = "#87b63c";
  return wrapEmail(
    banner("💰", "Заявка на выкуп автомобиля", GREEN) +
    heading("Клиент хочет продать автомобиль", "Заявка оставлена через форму выкупа на сайте") +
    dataTable([
      ["Имя клиента",    d.name],
      ["Телефон",        d.phone],
      ["Марка / Модель", d.brand && d.model ? `${d.brand} ${d.model}` : (d.brand || d.model)],
      ["Год выпуска",    d.year],
      ["Пробег",         d.mileage ? Number(d.mileage).toLocaleString("ru-RU") + " км" : undefined],
      ["Поколение",      d.generation],
      ["Тип кузова",     d.body],
      ["Оценка выкупа",  d.estimateMin && d.estimateMax
        ? `${Number(d.estimateMin).toLocaleString("ru-RU")} — ${Number(d.estimateMax).toLocaleString("ru-RU")} ₽`
        : (d.estimateMin ? `от ${Number(d.estimateMin).toLocaleString("ru-RU")} ₽` : undefined)],
      ["Комментарий",    d.comment],
    ]) +
    hr() +
    actionBlock(d.phone, undefined, "Перезвонить и подтвердить цену", GREEN),
    GREEN
  );
}

function buildFeedbackHtml(d: Record<string, string>) {
  return wrapEmail(
    banner("✉️", "Обращение через форму контактов", BLUE) +
    heading("Новое сообщение от клиента", "Сообщение получено через форму на странице /contacts") +
    dataTable([
      ["Имя клиента", d.name],
      ["Телефон",     d.phone],
      ["Email",       d.email],
    ]) +
    (d.message ? msgBox(d.message) : "") +
    hr() +
    actionBlock(d.phone, d.email, "Ответить клиенту", BLUE),
    BLUE
  );
}

/* ── Subject lines ── */
const SUBJECTS: Record<string, string> = {
  callback:   "📞 Заказать звонок",
  testdrive:  "🏁 Тест-драйв",
  credit:     "💳 Автокредит",
  tradein:    "🔄 Trade-in",
  buyout:     "💰 Выкуп автомобиля",
  vacancy:    "💼 Отклик на вакансию",
  openresume: "📋 Открытый отклик",
  feedback:   "✉️ Форма контактов",
};

/* ── Main send endpoint ── */
router.post(
  "/send-email",
  upload.array("attachments", 5),
  async (req, res) => {
    try {
      const body = req.body as Record<string, string>;
      const type = body.type as string;

      if (!type || !SUBJECTS[type]) {
        return res.status(400).json({ ok: false, error: "Unknown form type: " + type });
      }

      // Build HTML
      let html = "";
      switch (type) {
        case "callback":   html = buildCallbackHtml(body); break;
        case "testdrive":  html = buildTestDriveHtml(body); break;
        case "credit":     html = buildCreditHtml(body); break;
        case "tradein":    html = buildTradeInHtml(body); break;
        case "buyout":     html = buildBuyoutHtml(body); break;
        case "vacancy":    html = buildVacancyHtml(body); break;
        case "openresume": html = buildOpenResumeHtml(body); break;
        case "feedback":   html = buildFeedbackHtml(body); break;
      }

      const clientName = body.name || "Клиент";
      const subject = `${SUBJECTS[type]} — ${clientName} | debryansk-auto.ru`;

      // Attachments
      const files = (req.files || []) as Express.Multer.File[];
      const attachments = files.map((f) => ({
        filename: f.originalname,
        content: f.buffer,
        contentType: f.mimetype,
      }));

      const transporter = createTransport();
      await transporter.sendMail({
        from: FROM,
        to: TO,
        subject,
        html,
        attachments,
      });

      // Save lead to database
      try {
        const carParts = [body.carMark, body.carModel, body.carYear].filter(Boolean).join(" ");
        const extraData: Record<string, string> = {};
        const knownKeys = ["type","name","phone","email","message","carMark","carModel","carYear","carPrice","car","budget","downPayment","term","carMileage","position","surname","brand","model","vehicle"];
        for (const [k, v] of Object.entries(body)) {
          if (!knownKeys.includes(k) && v) extraData[k] = v;
        }
        await db.insert(leadsTable).values({
          type,
          name: body.name || null,
          phone: body.phone || null,
          email: body.email || null,
          message: body.message || body.comment || null,
          car: carParts || body.car || body.brand || body.model || body.vehicle || null,
          extraJson: Object.keys(extraData).length ? extraData : null,
        });
      } catch (dbErr) {
        console.error("[email] lead save error:", dbErr);
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error("[email] send error:", err);
      return res.status(500).json({ ok: false, error: String(err) });
    }
  }
);

/* ── SMTP test endpoint ── */
router.get("/send-email/test", async (_req, res) => {
  try {
    const transporter = createTransport();
    await transporter.verify();
    return res.json({ ok: true, message: "SMTP connection successful" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
