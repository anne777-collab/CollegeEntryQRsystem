const AUTH_PASSWORD = "admin123";
const page = document.body.dataset.page;

function setMessage(element, message, type = "") {
    if (!element) return;
    element.textContent = message;
    element.className = "inline-message";
    if (type) {
        element.classList.add(type);
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function setButtonLoading(button, isLoading, loadingLabel = "Loading...") {
    if (!button) return;

    const label = button.querySelector(".button-label");
    if (label) {
        if (!button.dataset.defaultLabel) {
            button.dataset.defaultLabel = label.textContent;
        }
        label.textContent = isLoading ? loadingLabel : button.dataset.defaultLabel;
    }

    button.disabled = isLoading;
    button.classList.toggle("is-loading", isLoading);
}

async function parseJsonResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const detail = data.detail || "Something went wrong. Please try again.";
        throw new Error(detail);
    }
    return data;
}

function formatDate(value) {
    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function playBeep() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.08;

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.12);
        oscillator.onended = () => audioContext.close();
    } catch (error) {
        console.debug("Beep playback unavailable.", error);
    }
}

function enableSessionLockButtons() {
    document.querySelectorAll("[data-lock-session]").forEach((button) => {
        button.addEventListener("click", () => {
            sessionStorage.removeItem("auth");
            window.location.reload();
        });
    });
}

function protectPage(onAuthorized) {
    const overlay = document.getElementById("authOverlay");
    const form = document.getElementById("authForm");
    const passwordInput = document.getElementById("authPassword");
    const error = document.getElementById("authError");
    const protectedContent = document.getElementById("protectedContent");
    let initialized = false;

    function authorize() {
        document.body.classList.add("auth-ready");
        protectedContent?.setAttribute("aria-hidden", "false");
        if (overlay) {
            overlay.classList.add("auth-overlay--hidden");
            window.setTimeout(() => {
                overlay.hidden = true;
            }, 240);
        }

        if (!initialized) {
            initialized = true;
            onAuthorized();
        }
    }

    if (sessionStorage.getItem("auth") === "true") {
        authorize();
        return;
    }

    if (!overlay || !form || !passwordInput) {
        onAuthorized();
        return;
    }

    window.setTimeout(() => passwordInput.focus(), 120);

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (passwordInput.value === AUTH_PASSWORD) {
            sessionStorage.setItem("auth", "true");
            if (error) error.textContent = "";
            authorize();
            return;
        }

        sessionStorage.removeItem("auth");
        if (error) {
            error.textContent = "Incorrect Password";
        }
        passwordInput.select();
    });
}

function initRegistrationPage() {
    const form = document.getElementById("registrationForm");
    const message = document.getElementById("registrationMessage");
    const resultCard = document.getElementById("registrationResult");
    const submitButton = document.getElementById("registrationSubmit");
    const tokenTarget = document.getElementById("resultToken");
    const qrImage = document.getElementById("qrImage");
    const downloadButton = document.getElementById("downloadQrButton");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        setMessage(message, "Registering student and generating QR code...");
        setButtonLoading(submitButton, true, "Generating Pass...");

        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        try {
            const data = await parseJsonResponse(
                await fetch("/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                })
            );

            tokenTarget.textContent = data.token;
            qrImage.src = data.qr_code_url;
            qrImage.alt = `QR code for token ${data.token}`;
            downloadButton.href = data.qr_code_url;
            downloadButton.download = `${data.token}.png`;
            resultCard.classList.remove("hidden");
            setMessage(message, "QR pass generated successfully.", "success");
            form.reset();
            resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (error) {
            setMessage(message, error.message, "error");
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

function setScanStatus(status, title, message) {
    const container = document.getElementById("scanStatus");
    const titleNode = document.getElementById("scanTitle");
    const messageNode = document.getElementById("scanMessage");
    const pill = container.querySelector(".status-pill");

    container.className = `scan-status ${status}`;
    pill.textContent = status === "neutral" ? "Ready" : status.toUpperCase();
    titleNode.textContent = title;
    messageNode.textContent = message;
}

function initScannerPage() {
    const scannerHint = document.getElementById("scannerHint");
    let isVerifying = false;
    let scanLockedUntil = 0;
    let lastToken = "";

    async function verifyToken(token) {
        const trimmedToken = token.trim();
        if (!trimmedToken) return;

        const now = Date.now();
        if (isVerifying || now < scanLockedUntil || trimmedToken === lastToken) {
            return;
        }

        isVerifying = true;
        scanLockedUntil = now + 1800;
        lastToken = trimmedToken;
        scannerHint.textContent = "QR detected. Verifying entry...";

        try {
            playBeep();
            const result = await parseJsonResponse(
                await fetch("/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: trimmedToken }),
                })
            );

            if (result.status === "VALID") {
                setScanStatus("valid", "Entry Allowed", result.message);
            } else if (result.status === "USED") {
                setScanStatus("used", "Already Used", result.message);
            } else {
                setScanStatus("invalid", "Invalid QR", result.message);
            }
        } catch (error) {
            setScanStatus("invalid", "Verification Failed", error.message);
        } finally {
            scannerHint.textContent = "Scanner is active. Show the next QR code to the camera.";
            window.setTimeout(() => {
                isVerifying = false;
                lastToken = "";
            }, 1600);
        }
    }

    function waitForScannerLibrary() {
        if (typeof Html5Qrcode === "undefined") {
            window.setTimeout(waitForScannerLibrary, 150);
            return;
        }

        const html5QrCode = new Html5Qrcode("scannerViewport");
        html5QrCode
            .start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: (viewportWidth, viewportHeight) => {
                        const size = Math.floor(Math.min(viewportWidth, viewportHeight) * 0.76);
                        return { width: size, height: size };
                    },
                },
                (decodedText) => verifyToken(decodedText),
                () => {}
            )
            .then(() => {
                scannerHint.textContent = "Scanner is active. Show the QR code to the camera.";
            })
            .catch((error) => {
                scannerHint.textContent = "Camera start failed. Please allow access and refresh the page.";
                setScanStatus("invalid", "Scanner Unavailable", String(error));
            });
    }

    waitForScannerLibrary();
}

function renderStudents(students, activeFilter) {
    const tableBody = document.getElementById("studentsTableBody");
    const searchValue = document.getElementById("searchRoll").value.trim().toLowerCase();

    const filteredStudents = students.filter((student) => {
        const matchesSearch = student.roll_no.toLowerCase().includes(searchValue);
        const matchesFilter =
            activeFilter === "all" ||
            (activeFilter === "used" && student.is_used) ||
            (activeFilter === "not-used" && !student.is_used);

        return matchesSearch && matchesFilter;
    });

    if (!filteredStudents.length) {
        tableBody.innerHTML = '<tr><td colspan="7" class="empty-state">No students match the current filter.</td></tr>';
        return;
    }

    tableBody.innerHTML = filteredStudents
        .map(
            (student) => `
                <tr>
                    <td>${escapeHtml(student.name)}</td>
                    <td>${escapeHtml(student.roll_no)}</td>
                    <td>${escapeHtml(student.course)}</td>
                    <td>${escapeHtml(student.contact)}</td>
                    <td>
                        <span class="status-badge ${student.is_used ? "used" : "not-used"}">
                            ${student.is_used ? "Used" : "Not Used"}
                        </span>
                    </td>
                    <td>${escapeHtml(formatDate(student.created_at))}</td>
                    <td>
                        <button type="button" class="delete-button" data-delete-student="${student.id}">
                            Delete
                        </button>
                    </td>
                </tr>
            `
        )
        .join("");
}

function updateAdminStats(students) {
    const total = students.length;
    const used = students.filter((student) => student.is_used).length;
    const remaining = total - used;

    document.getElementById("statTotal").textContent = String(total);
    document.getElementById("statUsed").textContent = String(used);
    document.getElementById("statRemaining").textContent = String(remaining);
}

function setActiveFilterButton(activeFilter) {
    document.querySelectorAll(".filter-chip").forEach((button) => {
        button.classList.toggle("active", button.dataset.filter === activeFilter);
    });
}

function initAdminPage() {
    const message = document.getElementById("adminMessage");
    const searchRoll = document.getElementById("searchRoll");
    const refreshButton = document.getElementById("refreshStudents");
    const tableBody = document.getElementById("studentsTableBody");
    const filterButtons = document.querySelectorAll(".filter-chip");
    let students = [];
    let activeFilter = "all";

    async function loadStudents() {
        setMessage(message, "Loading registered students...");
        refreshButton.disabled = true;

        try {
            students = await parseJsonResponse(await fetch("/students"));
            updateAdminStats(students);
            renderStudents(students, activeFilter);
            setMessage(message, `${students.length} students loaded.`, "success");
        } catch (error) {
            tableBody.innerHTML =
                '<tr><td colspan="7" class="empty-state">Unable to load student data.</td></tr>';
            setMessage(message, error.message, "error");
        } finally {
            refreshButton.disabled = false;
        }
    }

    tableBody.addEventListener("click", async (event) => {
        const deleteButton = event.target.closest("[data-delete-student]");
        if (!deleteButton) {
            return;
        }

        const studentId = deleteButton.dataset.deleteStudent;
        if (!window.confirm("Are you sure you want to delete this student?")) {
            return;
        }

        deleteButton.disabled = true;
        deleteButton.textContent = "Deleting...";

        try {
            const data = await parseJsonResponse(
                await fetch(`/student/${studentId}`, {
                    method: "DELETE",
                })
            );

            students = students.filter((student) => String(student.id) !== studentId);
            updateAdminStats(students);
            renderStudents(students, activeFilter);
            setMessage(message, data.message, "success");
        } catch (error) {
            deleteButton.disabled = false;
            deleteButton.textContent = "Delete";
            setMessage(message, error.message, "error");
        }
    });

    searchRoll.addEventListener("input", () => renderStudents(students, activeFilter));

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            activeFilter = button.dataset.filter;
            setActiveFilterButton(activeFilter);
            renderStudents(students, activeFilter);
        });
    });

    refreshButton.addEventListener("click", loadStudents);
    setActiveFilterButton(activeFilter);
    loadStudents();
}

enableSessionLockButtons();

if (page === "registration") {
    initRegistrationPage();
}

if (page === "scanner") {
    protectPage(initScannerPage);
}

if (page === "admin") {
    protectPage(initAdminPage);
}
