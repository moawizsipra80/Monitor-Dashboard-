let performanceChart = null;
let allProcesses = [];
let websocket = null;
function initChart() {
    const ctx = document.getElementById('performance-chart').getContext('2d');

    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(20).fill(''),
            datasets: [
                {
                    label: 'CPU Usage (%)',
                    borderColor: '#00d2ff',
                    backgroundColor: 'rgba(0, 210, 255, 0.1)',
                    borderWidth: 2,
                    data: Array(20).fill(0),
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Memory Usage (%)',
                    borderColor: '#00e676',
                    backgroundColor: 'rgba(0, 230, 118, 0.1)',
                    borderWidth: 2,
                    data: Array(20).fill(0),
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#888' }
                },
                x: {
                    grid: { display: false },
                    ticks: { display: false }
                }
            },
            plugins: {
                legend: { labels: { color: '#fff' } }
            }
        }
    });
}


function updateChart(cpu, memory) {
    if (!performanceChart) return;

    performanceChart.data.labels.shift();
    performanceChart.data.labels.push('');

    performanceChart.data.datasets[0].data.shift();
    performanceChart.data.datasets[0].data.push(cpu);

    performanceChart.data.datasets[1].data.shift();
    performanceChart.data.datasets[1].data.push(memory);

    performanceChart.update('none');
}


function connectWebSocket() {
    const statusDot = document.getElementById('connection-status');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketUrl = `${protocol}//${window.location.host}/ws`;

    websocket = new WebSocket(socketUrl);

    websocket.onopen = () => {
        statusDot.className = 'status-badge connected';
        statusDot.innerHTML = '<span class="status-dot"></span> Connected';
        console.log("WebSocket connected");
    };

    websocket.onmessage = (event) => {
        try {
            const stats = JSON.parse(event.data);

            // 1. Update CPU Card
            document.getElementById('cpu-value').innerText = `${stats.cpu.toFixed(1)}%`;
            document.getElementById('cpu-progress').style.width = `${stats.cpu}%`;

            // 2. Update Memory Card
            document.getElementById('memory-value').innerText = `${stats.memory.toFixed(1)}%`;
            document.getElementById('memory-progress').style.width = `${stats.memory}%`;

            // 3. Update Disk Card
            document.getElementById('disk-value').innerText = `${stats.disk.toFixed(1)}%`;
            document.getElementById('disk-progress').style.width = `${stats.disk}%`;

            // 4. Update Network speeds
            document.getElementById('net-sent').innerText = `${stats.bytes_sent.toFixed(2)} MB/s`;
            document.getElementById('net-received').innerText = `${stats.bytes_received.toFixed(2)} MB/s`;

            // 5. Update Line Chart
            updateChart(stats.cpu, stats.memory);
        } catch (e) {
            console.error("Error parsing statistics data", e);
        }
    };

    websocket.onclose = () => {
        statusDot.className = 'status-badge disconnected';
        statusDot.innerHTML = '<span class="status-dot"></span> Disconnected';
        console.log("WebSocket disconnected. Attempting to reconnect...");
        setTimeout(connectWebSocket, 3000);
    };
}


async function fetchProcesses() {
    try {
        const response = await fetch('/api/process');
        if (!response.ok) throw new Error("Failed to load processes");
        allProcesses = await response.json();
        renderProcessTable();
    } catch (error) {
        console.error("Error fetching processes:", error);
    }
}

function renderProcessTable() {
    const tableBody = document.getElementById('process-table-body');
    const searchQuery = document.getElementById('process-search').value.toLowerCase();

    const filtered = allProcesses.filter(p =>
        (p.name && p.name.toLowerCase().includes(searchQuery)) ||
        p.pid.toString().includes(searchQuery)
    );

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">No matching processes found</td></tr>`;
        return;
    }

    tableBody.innerHTML = filtered.map(p => `
        <tr>
            <td>${p.username || 'System'}</td>
            <td><strong>${p.pid}</strong></td>
            <td>${p.name}</td>
            <td><span class="cpu-badge">${p.cpu_percent.toFixed(1)}%</span></td>
            <td>${p.memory_percent ? p.memory_percent.toFixed(1) + '%' : 'N/A'}</td>
            <td>
                <button class="btn-kill" onclick="killProcess(${p.pid})">
                    <i class="fa-solid fa-ban"></i> Kill
                </button>
            </td>
        </tr>
    `).join('');
}

async function killProcess(pid) {
    if (!confirm(`Are you sure you want to terminate process ID ${pid}?`)) return;

    try {
        const response = await fetch(`/api/processes/kill/${pid}`, { method: 'POST' });
        const result = await response.json();
        if (response.ok) {
            alert(result.message);
            fetchProcesses();
        } else {
            alert(`Error: ${result.detail || 'Failed to kill process'}`);
        }
    } catch (error) {
        alert("Server communication error");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initChart();
    connectWebSocket();
    fetchProcesses();

    setInterval(fetchProcesses, 3000);

    document.getElementById('process-search').addEventListener('input', renderProcessTable);
});
