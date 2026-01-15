/**
 * Chart Generator
 * Generates beautiful chart images using Puppeteer + Chart.js
 */

const puppeteer = require('puppeteer');
const { AttachmentBuilder } = require('discord.js');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('ChartGenerator');

class ChartGenerator {
  static browser = null;

  static async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  /**
   * Generate skill progression chart
   * Shows: Approaches → Numbers → Dates → Closes over time
   */
  static async generateSkillProgressionChart(data, username) {
    await this.initialize();

    const dates = data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const approaches = data.map(d => d.cumulativeApproaches);
    const numbers = data.map(d => d.cumulativeNumbers);
    const dates_data = data.map(d => d.cumulativeDates);
    const closes = data.map(d => d.cumulativeCloses);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: 'Inter', -apple-system, sans-serif;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 30px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      margin: 0 0 20px 0;
      font-size: 28px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    canvas {
      max-width: 100%;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📈 ${username}'s Skill Progression</h1>
    <canvas id="chart" width="900" height="500"></canvas>
  </div>
  <script>
    const ctx = document.getElementById('chart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(dates)},
        datasets: [
          {
            label: 'Approaches',
            data: ${JSON.stringify(approaches)},
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
          },
          {
            label: 'Numbers Collected',
            data: ${JSON.stringify(numbers)},
            borderColor: '#4ecdc4',
            backgroundColor: 'rgba(78, 205, 196, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
          },
          {
            label: 'Dates',
            data: ${JSON.stringify(dates_data)},
            borderColor: '#ffd700',
            backgroundColor: 'rgba(255, 215, 0, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
          },
          {
            label: 'Closes',
            data: ${JSON.stringify(closes)},
            borderColor: '#ff6b6b',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { size: 14, weight: 'bold' },
              padding: 15
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { font: { size: 12 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, maxRotation: 45 }
          }
        }
      }
    });
  </script>
</body>
</html>
    `;

    const page = await this.browser.newPage();
    await page.setViewport({ width: 1000, height: 650, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.waitForTimeout(1000); // Wait for chart animation

    const screenshot = await page.screenshot({ type: 'png' });
    await page.close();

    return new AttachmentBuilder(screenshot, { name: 'skill-progression.png' });
  }

  /**
   * Generate emotional state chart with moving averages
   */
  static async generateEmotionalStateChart(data, username) {
    await this.initialize();

    const dates = data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const states = data.map(d => d.state);
    const ma7 = data.map(d => d.ma7);
    const ma14 = data.map(d => d.ma14);
    const ma30 = data.map(d => d.ma30);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #ee5a6f 0%, #f29263 100%);
      font-family: 'Inter', -apple-system, sans-serif;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 30px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      margin: 0 0 20px 0;
      font-size: 28px;
      background: linear-gradient(135deg, #ee5a6f, #f29263);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>❤️ ${username}'s Emotional State Journey</h1>
    <canvas id="chart" width="900" height="500"></canvas>
  </div>
  <script>
    const ctx = document.getElementById('chart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(dates)},
        datasets: [
          {
            label: 'Daily State',
            data: ${JSON.stringify(states)},
            borderColor: 'rgba(238, 90, 111, 0.3)',
            backgroundColor: 'rgba(238, 90, 111, 0.05)',
            borderWidth: 1,
            pointRadius: 3,
            pointBackgroundColor: '#ee5a6f',
            fill: true
          },
          {
            label: '7-Day Average',
            data: ${JSON.stringify(ma7)},
            borderColor: '#ffd700',
            borderWidth: 3,
            pointRadius: 0,
            fill: false,
            tension: 0.4
          },
          {
            label: '14-Day Average',
            data: ${JSON.stringify(ma14)},
            borderColor: '#4ecdc4',
            borderWidth: 2.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            tension: 0.4
          },
          {
            label: '30-Day Trend',
            data: ${JSON.stringify(ma30)},
            borderColor: '#667eea',
            borderWidth: 3,
            pointRadius: 0,
            fill: false,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { size: 14, weight: 'bold' },
              padding: 15,
              usePointStyle: true
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(0,0,0,0.9)',
            padding: 12
          }
        },
        scales: {
          y: {
            min: 0,
            max: 10,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              font: { size: 12 },
              callback: function(value) {
                return value + '/10';
              }
            }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, maxRotation: 45 }
          }
        }
      }
    });
  </script>
</body>
</html>
    `;

    const page = await this.browser.newPage();
    await page.setViewport({ width: 1000, height: 650, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.waitForTimeout(1000);

    const screenshot = await page.screenshot({ type: 'png' });
    await page.close();

    return new AttachmentBuilder(screenshot, { name: 'emotional-state.png' });
  }

  /**
   * Generate habit correlation chart
   */
  static async generateHabitCorrelationChart(data, username) {
    await this.initialize();

    const meditationImpact = [
      data.insights.meditationImpact.approaches.with,
      data.insights.meditationImpact.approaches.without
    ];

    const meditationStateImpact = [
      data.insights.meditationImpact.state.with,
      data.insights.meditationImpact.state.without
    ];

    const workoutConfidenceImpact = [
      data.insights.workoutImpact.confidence.with,
      data.insights.workoutImpact.confidence.without
    ];

    const html = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #38ef7d 0%, #11998e 100%);
      font-family: 'Inter', -apple-system, sans-serif;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 30px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
      background: linear-gradient(135deg, #38ef7d, #11998e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .charts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }
    .chart-box canvas {
      max-width: 100%;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧘 ${username}'s Habit Impact Analysis</h1>
    <p class="subtitle">How your daily habits affect your performance</p>
    
    <div class="charts">
      <div class="chart-box">
        <canvas id="chart1" width="400" height="300"></canvas>
      </div>
      <div class="chart-box">
        <canvas id="chart2" width="400" height="300"></canvas>
      </div>
    </div>
  </div>
  <script>
    // Meditation → Approaches
    const ctx1 = document.getElementById('chart1').getContext('2d');
    new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: ['With Meditation', 'Without Meditation'],
        datasets: [{
          label: 'Avg Daily Approaches',
          data: ${JSON.stringify(meditationImpact)},
          backgroundColor: ['#38ef7d', '#ee5a6f'],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Meditation Impact on Approaches',
            font: { size: 16, weight: 'bold' }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { font: { size: 12 } }
          }
        }
      }
    });

    // Workout → Confidence
    const ctx2 = document.getElementById('chart2').getContext('2d');
    new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: ['With Workout', 'Without Workout'],
        datasets: [{
          label: 'Avg Confidence',
          data: ${JSON.stringify(workoutConfidenceImpact)},
          backgroundColor: ['#667eea', '#f29263'],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Workout Impact on Confidence',
            font: { size: 16, weight: 'bold' }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 10,
            ticks: { font: { size: 12 } }
          }
        }
      }
    });
  </script>
</body>
</html>
    `;

    const page = await this.browser.newPage();
    await page.setViewport({ width: 1000, height: 500, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.waitForTimeout(1000);

    const screenshot = await page.screenshot({ type: 'png' });
    await page.close();

    return new AttachmentBuilder(screenshot, { name: 'habit-correlation.png' });
  }

  /**
   * Generate conversion funnel chart
   */
  static async generateConversionFunnelChart(data, username) {
    await this.initialize();

    // Get most recent week's data
    const recentData = data.slice(-7);
    
    const totalApproaches = recentData.reduce((sum, d) => sum + d.approaches, 0);
    const totalNumbers = recentData.reduce((sum, d) => sum + d.numbers, 0);
    const totalDates = recentData.reduce((sum, d) => sum + d.dates, 0);
    const totalCloses = recentData.reduce((sum, d) => sum + d.closes, 0);

    const approachToNumberRate = totalApproaches > 0 ? (totalNumbers / totalApproaches * 100).toFixed(1) : 0;
    const numberToDateRate = totalNumbers > 0 ? (totalDates / totalNumbers * 100).toFixed(1) : 0;
    const dateToCloseRate = totalDates > 0 ? (totalCloses / totalDates * 100).toFixed(1) : 0;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      font-family: 'Inter', -apple-system, sans-serif;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      margin: 0 0 30px 0;
      font-size: 28px;
      text-align: center;
      background: linear-gradient(135deg, #f093fb, #f5576c);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .funnel {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .funnel-stage {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .funnel-bar {
      flex: 1;
      height: 60px;
      background: linear-gradient(90deg, #667eea, #764ba2);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      color: white;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .funnel-bar.approaches { background: linear-gradient(90deg, #667eea, #764ba2); }
    .funnel-bar.numbers { background: linear-gradient(90deg, #4ecdc4, #44a08d); width: 80%; }
    .funnel-bar.dates { background: linear-gradient(90deg, #ffd700, #ffed4e); width: 60%; }
    .funnel-bar.closes { background: linear-gradient(90deg, #ff6b6b, #ee5a6f); width: 40%; }
    
    .funnel-number {
      font-size: 24px;
    }
    .funnel-label {
      font-size: 16px;
    }
    .conversion-rate {
      min-width: 80px;
      text-align: center;
      font-size: 14px;
      color: #666;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎯 ${username}'s Conversion Funnel (Last 7 Days)</h1>
    
    <div class="funnel">
      <div class="funnel-stage">
        <div class="funnel-bar approaches">
          <span class="funnel-label">Approaches</span>
          <span class="funnel-number">${totalApproaches}</span>
        </div>
        <div class="conversion-rate">100%</div>
      </div>

      <div class="funnel-stage">
        <div class="funnel-bar numbers">
          <span class="funnel-label">Numbers Collected</span>
          <span class="funnel-number">${totalNumbers}</span>
        </div>
        <div class="conversion-rate">${approachToNumberRate}%</div>
      </div>

      <div class="funnel-stage">
        <div class="funnel-bar dates">
          <span class="funnel-label">Dates</span>
          <span class="funnel-number">${totalDates}</span>
        </div>
        <div class="conversion-rate">${numberToDateRate}%</div>
      </div>

      <div class="funnel-stage">
        <div class="funnel-bar closes">
          <span class="funnel-label">Closes</span>
          <span class="funnel-number">${totalCloses}</span>
        </div>
        <div class="conversion-rate">${dateToCloseRate}%</div>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const page = await this.browser.newPage();
    await page.setViewport({ width: 900, height: 600, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const screenshot = await page.screenshot({ type: 'png' });
    await page.close();

    return new AttachmentBuilder(screenshot, { name: 'conversion-funnel.png' });
  }

  static async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = ChartGenerator;

