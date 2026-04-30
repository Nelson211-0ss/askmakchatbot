const { expandAbbreviations } = require('./embedding');

/**
 * Removes the latest user message from history when it matches the message
 * currently being answered (avoids duplicating the user turn in the LLM prompt).
 */
function stripLatestUserTurn(history, userContent, imageKey) {
    if (!history.length) return history;
    const last = history[history.length - 1];
    if (last.role !== 'user') return history;

    const sameText = (last.content || '') === (userContent || '');
    if (imageKey) {
        if (last.image_key === imageKey && sameText) return history.slice(0, -1);
        return history;
    }
    if (!last.image_key && sameText) return history.slice(0, -1);
    return history;
}

/**
 * Builds a standalone search query from follow-ups ("What about fees?") by
 * folding in recent user turns from prior history.
 */
function buildStandaloneSearchQuery(priorHistory, userContent) {
    const text = (userContent || '').trim();
    const userMsgs = priorHistory
        .filter(m => m.role === 'user' && (m.content || '').trim())
        .map(m => m.content.trim());

    const short = text.length < 56;
    const followUp =
        /^(what about|and |how (do|can|are|is)|is it|the same|where |when |who |which |can i|does |what if|also )/i.test(
            text
        );

    if (userMsgs.length && (short || followUp)) {
        const joined = [...userMsgs.slice(-2), text].join(' ').replace(/\s+/g, ' ').trim();
        return expandAbbreviations(joined.substring(0, 500));
    }
    return expandAbbreviations(text);
}

module.exports = { stripLatestUserTurn, buildStandaloneSearchQuery };
