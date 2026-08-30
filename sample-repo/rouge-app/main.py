import os
import sys
import time
import signal
import multiprocessing
import threading

# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

sys.stdout.reconfigure(line_buffering=True)

STRESS_CPU = os.getenv("STRESS_CPU", "false").lower() == "true"
STRESS_MEM = os.getenv("STRESS_MEM", "false").lower() == "true"
STRESS_PIDS = os.getenv("STRESS_PIDS", "false").lower() == "true"

MEM_STEP_MB = int(os.getenv("MEM_STEP_MB", "50"))
MEM_SLEEP_SEC = float(os.getenv("MEM_SLEEP_SEC", "1.0"))

# If true:
# 50 -> 100 -> 200 -> 400 -> 800 MB ...
MEM_EXPONENTIAL = os.getenv("MEM_EXPONENTIAL", "false").lower() == "true"

# Number of CPU workers. 0 = automatically detect CPUs.
CPU_WORKERS = int(os.getenv("CPU_WORKERS", "0"))

# PID creation rate.
PID_FORK_INTERVAL = float(os.getenv("PID_FORK_INTERVAL", "0.05"))

# Optional hard upper bound for this application.
# This prevents accidental runaway testing.
PID_MAX_CHILDREN = int(os.getenv("PID_MAX_CHILDREN", "1000"))


# ---------------------------------------------------------
# Logging
# ---------------------------------------------------------

def log(message):
    print(message, flush=True)


# ---------------------------------------------------------
# CPU STRESSOR
# ---------------------------------------------------------

def cpu_stresser(worker_id):
    log(f"🔥 [CPU-{worker_id}] CPU burner started")

    # Keep computation entirely CPU-bound.
    x = 0

    while True:
        x = (x * 1664525 + 1013904223) & 0xFFFFFFFF
        x ^= x >> 13
        x = (x * 2654435761) & 0xFFFFFFFF

        # Prevent Python from optimizing the loop into anything unexpected.
        if x == -1:
            log("impossible")


# ---------------------------------------------------------
# MEMORY STRESSOR
# ---------------------------------------------------------

def mem_stresser():
    log("🧠 [MEM] Memory stresser started")

    allocations = []
    step_mb = MEM_STEP_MB
    total_mb = 0

    while True:
        try:
            size = step_mb * 1024 * 1024

            log(
                f"💾 [MEM] Allocating {step_mb} MB "
                f"(target total: {total_mb + step_mb} MB)"
            )

            # bytearray actually touches the memory.
            # Writing to every page prevents the allocation from
            # remaining merely virtual/lazy.
            chunk = bytearray(size)

            page_size = 4096

            for offset in range(0, len(chunk), page_size):
                chunk[offset] = 1

            allocations.append(chunk)

            total_mb += step_mb

            log(f"💾 [MEM] Resident allocation ≈ {total_mb} MB")

            if MEM_EXPONENTIAL:
                step_mb *= 2

            time.sleep(MEM_SLEEP_SEC)

        except MemoryError:
            log("🛑 [MEM] Python MemoryError encountered")
            break

        except Exception as exc:
            log(f"❌ [MEM] Allocation failed: {exc}")
            break


# ---------------------------------------------------------
# PID STRESSOR
# ---------------------------------------------------------

def pid_child(child_id):
    # Children deliberately remain alive.
    # This makes PID consumption visible in Docker stats/top.
    while True:
        time.sleep(60)


def pid_stresser():
    log("💣 [PID] PID exhaustion stresser started")

    children = []

    while True:

        if len(children) >= PID_MAX_CHILDREN:
            log(
                f"🛑 [PID] Application safety limit reached: "
                f"{PID_MAX_CHILDREN} children"
            )

            while True:
                time.sleep(60)

        try:
            p = multiprocessing.Process(
                target=pid_child,
                args=(len(children),),
                daemon=False,
            )

            p.start()
            children.append(p)

            count = len(children)

            if count % 10 == 0:
                log(f"👶 [PID] Active children: {count}")

            time.sleep(PID_FORK_INTERVAL)

        except Exception as exc:
            log(f"🛑 [PID] Process creation failed: {exc}")

            # If Docker's PID limit is reached, don't spin at 100%
            # repeatedly trying to create more processes.
            time.sleep(2)


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():

    log("")
    log("🚀 ===========================================")
    log("🚀        HYPER-ROGUE APPLICATION")
    log("🚀 ===========================================")
    log("")
    log("Configuration:")
    log(f"  STRESS_CPU       = {STRESS_CPU}")
    log(f"  STRESS_MEM       = {STRESS_MEM}")
    log(f"  STRESS_PIDS      = {STRESS_PIDS}")
    log(f"  MEM_STEP_MB      = {MEM_STEP_MB}")
    log(f"  MEM_SLEEP_SEC    = {MEM_SLEEP_SEC}")
    log(f"  MEM_EXPONENTIAL  = {MEM_EXPONENTIAL}")
    log(f"  CPU_WORKERS      = {CPU_WORKERS}")
    log(f"  PID_FORK_INTERVAL= {PID_FORK_INTERVAL}")
    log(f"  PID_MAX_CHILDREN = {PID_MAX_CHILDREN}")
    log("")

    processes = []

    # -----------------------------------------------------
    # CPU
    # -----------------------------------------------------

    if STRESS_CPU:

        workers = CPU_WORKERS

        if workers <= 0:
            workers = multiprocessing.cpu_count()

        log(f"⚙️ [CPU] Launching {workers} CPU workers")

        for i in range(workers):

            p = multiprocessing.Process(
                target=cpu_stresser,
                args=(i,),
                name=f"CPU-{i}",
                daemon=False,
            )

            p.start()
            processes.append(p)

    # -----------------------------------------------------
    # MEMORY
    # -----------------------------------------------------

    if STRESS_MEM:

        p = multiprocessing.Process(
            target=mem_stresser,
            name="MEM-Stresser",
            daemon=False,
        )

        p.start()
        processes.append(p)

    # -----------------------------------------------------
    # PIDS
    # -----------------------------------------------------

    if STRESS_PIDS:

        p = multiprocessing.Process(
            target=pid_stresser,
            name="PID-Stresser",
            daemon=False,
        )

        p.start()
        processes.append(p)

    # -----------------------------------------------------
    # Nothing enabled
    # -----------------------------------------------------

    if not processes:

        log("⚠️ No stressors enabled.")
        log("Set STRESS_CPU, STRESS_MEM or STRESS_PIDS to true.")

        while True:
            time.sleep(60)

    # -----------------------------------------------------
    # Supervisor
    # -----------------------------------------------------

    log("")
    log("✅ All rogue stressors launched")
    log("📊 Application is now actively consuming resources")
    log("")

    try:

        while True:

            for p in processes:

                if not p.is_alive():

                    log(
                        f"⚠️ [{p.name}] exited "
                        f"(exit code={p.exitcode})"
                    )

            time.sleep(2)

    except KeyboardInterrupt:

        log("🛑 Shutdown requested")

        for p in processes:

            if p.is_alive():
                p.terminate()

        for p in processes:
            p.join(timeout=2)

        sys.exit(0)


if __name__ == "__main__":
    main()