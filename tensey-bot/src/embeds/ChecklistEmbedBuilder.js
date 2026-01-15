// ═══════════════════════════════════════════════════════════════════════════════
// Checklist embed builder - Complete UI within Discord component limits
// + Banner image support (card-style)
// ═══════════════════════════════════════════════════════════════════════════════

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { challenges } = require('../config/challenges');

function getSafeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.includes('your-banner-url')) return null;

  try {
    const u = new URL(url);
    if (!u.protocol.startsWith('http')) return null;
    return url;
  } catch {
    return null;
  }
}

function resolveChecklistBannerUrl() {
  return (
    process.env.TENSEY_CHECKLIST_BANNER_URL ||
    process.env.BANNER_URL_OPEN_BUTTON ||
    process.env.BANNER_URL_CHECKLIST ||
    null
  );
}

class ChecklistEmbedBuilder {
  /**
   * Build complete embed with button rows
   * @param {number} page - Current page (0-56)
   * @param {number[]} completedIndices - Array of completed challenge indices (0-based global indices)
   * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
   */
  static build(page, completedIndices = []) {
    const safePage = Number.isFinite(page) ? Math.max(0, Math.min(56, Number(page))) : 0;

    const completedSet = new Set(
      Array.isArray(completedIndices)
        ? completedIndices
            .map((v) => Number(v))
            .filter((v) => Number.isInteger(v) && v >= 0)
        : []
    );

    const list = Array.isArray(challenges) ? challenges : [];
    const totalChallenges = list.length || 567;

    const startIdx = safePage * 10;
    const endIdx = Math.min(startIdx + 10, list.length);
    const pageChallenges = list.slice(startIdx, endIdx);

    const level = pageChallenges[0]?.level || 1;
    const levelInfo = this._getLevelInfo(level);

    const completedCount = completedSet.size;
    const progressPct =
      totalChallenges > 0 ? Math.round((completedCount / totalChallenges) * 100) : 0;

    const embed = new EmbedBuilder()
      .setTitle(`${levelInfo.emoji} LEVEL ${level}: ${levelInfo.name.toUpperCase()}`)
      .setDescription(
        pageChallenges.length > 0
          ? this._buildChallengeList(pageChallenges, completedSet, startIdx)
          : '⚠️ No challenges found. Check your `config/challenges` import.'
      )
      .setColor(this._getLevelColor(level))
      .addFields({
        name: '📊 Your Progress',
        value: `${completedCount}/${totalChallenges} Challenges Completed (${progressPct}%)`,
        inline: false,
      })
      .setFooter({
        text: `Page ${safePage + 1}/57 • Click numbers to COMPLETE • UNDO reverses • INFO shows help`,
      })
      .setTimestamp();

    // ✅ Banner image (card style)
    const bannerUrl = getSafeImageUrl(resolveChecklistBannerUrl());
    if (bannerUrl) {
      embed.setImage(bannerUrl);
    }

    const components = [];

    // ROW 1 + ROW 2: Challenge buttons (1–5 and 6–10)
    const rowChallenges1 = new ActionRowBuilder();
    const rowChallenges2 = new ActionRowBuilder();

    for (let i = 0; i < pageChallenges.length; i++) {
      const globalIdx = startIdx + i;
      const isComplete = completedSet.has(globalIdx);

      const btn = new ButtonBuilder()
        .setCustomId(`checklist_toggle_P${safePage}_C${i}`)
        .setLabel(`${i + 1}`)
        .setStyle(isComplete ? ButtonStyle.Success : ButtonStyle.Secondary);

      if (isComplete) btn.setDisabled(true);

      if (i < 5) rowChallenges1.addComponents(btn);
      else rowChallenges2.addComponents(btn);
    }

    components.push(rowChallenges1);
    if (rowChallenges2.components.length > 0) components.push(rowChallenges2);

    // ROW NAV: Prev / Undo / Info / Next
    const rowNav = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`checklist_nav_prev_${safePage}`)
        .setLabel('◀️ Prev')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(safePage === 0),
      new ButtonBuilder()
        .setCustomId('checklist_undo')
        .setLabel('↩️ Undo')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`checklist_info_L${level}`)
        .setLabel('ℹ️ INFO')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`checklist_nav_next_${safePage}`)
        .setLabel('Next ▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(safePage >= 56)
    );

    components.push(rowNav);

    // ROW PAGES (max 5)
    const levelPages = this._getLevelPages(level);
    if (levelPages.length > 5) {
      const rowPages = new ActionRowBuilder();
      const visiblePages = this._getVisiblePages(safePage, levelPages);

      for (const p of visiblePages) {
        const isCurrent = p === safePage;
        rowPages.addComponents(
          new ButtonBuilder()
            .setCustomId(`checklist_page_${p}`)
            .setLabel(isCurrent ? `[${p + 1}]` : `${p + 1}`)
            .setStyle(isCurrent ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
      }

      components.push(rowPages);
    }

    // ROW LEVELS (max 5)
    const rowLevels = new ActionRowBuilder();
    const visibleLevels = this._getVisibleLevels(level);

    for (const l of visibleLevels) {
      const lInfo = this._getLevelInfo(l);
      const isCurrent = l === level;

      rowLevels.addComponents(
        new ButtonBuilder()
          .setCustomId(`checklist_level_${l}`)
          .setLabel(`${lInfo.emoji}L${l}`)
          .setStyle(isCurrent ? ButtonStyle.Success : ButtonStyle.Secondary)
      );
    }

    components.push(rowLevels);

    return { embed, components: components.slice(0, 5) };
  }

  static _buildChallengeList(pageChallenges, completedSet, startIdx) {
    return pageChallenges
      .map((challenge, i) => {
        const globalIdx = startIdx + i;
        const isComplete = completedSet.has(globalIdx);
        const checkbox = isComplete ? '✅' : '❌';
        const displayNumber = globalIdx + 1;
        return `${displayNumber}. ${checkbox} ${challenge.text}`;
      })
      .join('\n');
  }

  static _getLevelInfo(level) {
    const levelData = {
      1: { name: 'Basic Approach & Warm-Up', emoji: '🌱', count: 50 },
      2: { name: 'Social Creativity & Playfulness', emoji: '🎨', count: 70 },
      3: { name: 'Vulnerability & Authentic Expression', emoji: '💎', count: 80 },
      4: { name: 'Bold Social Experiments', emoji: '🚀', count: 100 },
      5: { name: 'Tension & Escalation', emoji: '⚡', count: 100 },
      6: { name: 'Embodied Approach Foundations', emoji: '🧘', count: 100 },
      7: { name: 'Deep Integration & Mastery', emoji: '🎯', count: 67 },
    };
    return levelData[level] || levelData[1];
  }

  static _getLevelColor(level) {
    const colors = {
      1: 0x00ff00,
      2: 0xff6b35,
      3: 0x6c5ce7,
      4: 0xfd79a8,
      5: 0xe74c3c,
      6: 0x00cec9,
      7: 0x2d3436,
    };
    return colors[level] || 0x000000;
  }

  static _getLevelPages(level) {
    const ranges = {
      1: [0, 4],
      2: [5, 11],
      3: [12, 19],
      4: [20, 29],
      5: [30, 39],
      6: [40, 49],
      7: [50, 56],
    };

    const [start, end] = ranges[level] || [0, 4];
    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  static _getVisiblePages(currentPage, allPages) {
    if (allPages.length <= 5) return allPages;

    const idx = allPages.indexOf(currentPage);
    if (idx === -1) return allPages.slice(0, 5);

    let start = Math.max(0, idx - 2);
    let end = Math.min(allPages.length, start + 5);

    if (end - start < 5) start = Math.max(0, end - 5);
    return allPages.slice(start, end);
  }

  static _getVisibleLevels(currentLevel) {
    const allLevels = [1, 2, 3, 4, 5, 6, 7];
    if (allLevels.length <= 5) return allLevels;

    const idx = allLevels.indexOf(currentLevel);
    if (idx === -1) return allLevels.slice(0, 5);

    let start = Math.max(0, idx - 2);
    let end = Math.min(allLevels.length, start + 5);

    if (end - start < 5) start = Math.max(0, end - 5);
    return allLevels.slice(start, end);
  }

  static buildChecklistEmbed(pageData) {
    return this.build(pageData?.page || 0, []).embed;
  }

  static buildNavigationButtons(pageData) {
    return this.build(pageData?.page || 0, []).components;
  }
}

module.exports = ChecklistEmbedBuilder;
