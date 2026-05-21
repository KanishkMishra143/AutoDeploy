import os
import time
import multiprocessing
import signal
import sys
import array

# Ensure unbuffered output for Docker logs
sys.stdout.reconfigure(line_buffering=True)

# Rogue configurations via Environment Variables
STRESS_CPU = os.getenv("STRESS_CPU", "false").lower() == "true"
STRESS_MEM = os.getenv("STRESS_MEM", "false").lower() == "true"
STRESS_PIDS = os.getenv("STRESS_PIDS", "false").lower() == "true"

MEM_STEP_MB = int(os.getenv("MEM_STEP_MB", "50"))
MEM_SLEEP_SEC = float(os.getenv("MEM_SLEEP_SEC", "1.0"))
MEM_EXPONENTIAL = os.getenv("MEM_EXPONENTIAL", "false").lower() == "true"

print("🚀 HYPER-ROGUE APP INITIALIZED", flush=True)
print(f"--- Configuration ---", flush=True)
print(f"STRESS_CPU:  {STRESS_CPU}", flush=True)
print(f"STRESS_MEM:  {STRESS_MEM} (Step: {MEM_STEP_MB}MB | Exponential: {MEM_EXPONENTIAL})", flush=True)
print(f"STRESS_PIDS: {STRESS_PIDS}", flush=True)
print(f"---------------------", flush=True)

def cpu_stresser(id):
    print(f"🔥 [CPU-{id}] Core burner started...", flush=True)
    try:
        while True:
            # Heavy mathematical computation
            _ = [x**2 for x in range(1000)]
    except Exception as e:
        print(f"❌ [CPU-{id}] Failed: {e}", flush=True)

def mem_stresser():
    print("🧠 [MEM] Memory Stresser Started...", flush=True)
    memory_hog = []
    current_step = MEM_STEP_MB
    
    try:
        while True:
            # Use 'array' for more efficient memory consumption that kernel can't ignore
            new_chunk = array.array('B', [0] * (current_step * 1024 * 1024))
            memory_hog.append(new_chunk)
            
            total_mb = sum(len(c) for c in memory_hog) // (1024 * 1024)
            print(f"💾 [MEM] Allocated {total_mb}MB total (Added {current_step}MB)", flush=True)
            
            if MEM_EXPONENTIAL:
                current_step *= 2
                
            time.sleep(MEM_SLEEP_SEC)
    except MemoryError:
        print("🛑 [MEM] MemoryError caught in child!", flush=True)
    except Exception as e:
        print(f"❌ [MEM] Unexpected Failure: {e}", flush=True)

def pid_stresser():
    print("💣 [PID] Fork-Bomb Stresser Started...", flush=True)
    children = []
    try:
        while True:
            pid = os.fork()
            if pid == 0:
                # Child process: just stay alive
                signal.signal(signal.SIGTERM, lambda s, f: sys.exit(0))
                while True: time.sleep(100)
            else:
                children.append(pid)
                if len(children) % 10 == 0:
                    print(f"👶 [PID] Active children count: {len(children)}", flush=True)
                time.sleep(0.2)
    except OSError as e:
        print(f"🛑 [PID] Fork failed (Limit reached?): {e}", flush=True)
        time.sleep(5)

if __name__ == "__main__":
    processes = []
    
    if STRESS_CPU:
        # Burn all available cores detected by Docker
        core_count = multiprocessing.cpu_count()
        print(f"⚙️ Detected {core_count} CPU cores. Launching burners...", flush=True)
        for i in range(core_count):
            p = multiprocessing.Process(target=cpu_stresser, args=(i,), name=f"CPU-{i}")
            p.daemon = True
            p.start()
            processes.append(p)
            
    if STRESS_MEM:
        p = multiprocessing.Process(target=mem_stresser, name="MEM-Stresser")
        p.daemon = True
        p.start()
        processes.append(p)
        
    if STRESS_PIDS:
        p = multiprocessing.Process(target=pid_stresser, name="PID-Stresser")
        p.daemon = True
        p.start()
        processes.append(p)

    print("✅ All stressors launched. Monitoring children...", flush=True)
    
    try:
        while True:
            # Monitor child processes
            for p in processes:
                if not p.is_alive():
                    print(f"⚠️ Process {p.name} died! Exit code: {p.exitcode}", flush=True)
                    if p.exitcode == -signal.SIGKILL:
                        print(f"🚨 ALERT: Process {p.name} was SIGKILLED (Likely OOM)!", flush=True)
                    processes.remove(p)
            
            if not processes and (STRESS_CPU or STRESS_MEM):
                print("💀 All stressors have died. Rogue app going idle.", flush=True)
                break
                
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Stopping rogue app...", flush=True)
        for p in processes: p.terminate()
        sys.exit(0)
    
    # Keep main process alive to maintain container state
    while True: time.sleep(10)
