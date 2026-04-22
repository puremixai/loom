import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings, useSaveSettings, useTestAi } from '@/api/settings';
import { usePlatform } from '@/api/platform';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserSkillsDirCard } from '@/components/UserSkillsDirCard';
import { SettingsNav } from '@/components/SettingsNav';
import i18n, { writeStoredLocale } from '@/i18n';
export function SettingsPage() {
    const { t } = useTranslation();
    const { data: settings } = useSettings();
    const { data: platform } = usePlatform();
    const save = useSaveSettings();
    const test = useTestAi();
    const [endpoint, setEndpoint] = useState('');
    const [model, setModel] = useState('');
    const [apiKeyEnv, setApiKeyEnv] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [requestStyle, setRequestStyle] = useState('openai');
    const [showKey, setShowKey] = useState(false);
    const [scanPathsText, setScanPathsText] = useState('');
    const [locale, setLocale] = useState(i18n.language ?? 'zh');
    const SETTINGS_SECTIONS = [
        { id: 'language', label: t('settings.sections.language') },
        { id: 'ai-config', label: t('settings.sections.ai') },
        { id: 'user-skills-dir', label: t('settings.sections.userSkillsDir') },
        { id: 'scan-paths', label: t('settings.sections.scanPaths') },
        { id: 'platform', label: t('settings.sections.platform') },
    ];
    useEffect(() => {
        if (!settings)
            return;
        setEndpoint(settings.ai.endpoint ?? '');
        setModel(settings.ai.model ?? '');
        setApiKeyEnv(settings.ai.apiKeyEnv ?? '');
        setApiKey(settings.ai.apiKey ?? '');
        setSystemPrompt(settings.ai.systemPrompt ?? '');
        setRequestStyle(settings.ai.requestStyle ?? 'openai');
        setScanPathsText(settings.scanPaths.join('\n'));
    }, [settings]);
    async function handleSave() {
        await save.mutateAsync({
            scanPaths: scanPathsText.split('\n').map(s => s.trim()).filter(Boolean),
            ai: {
                endpoint: endpoint.trim(),
                model: model.trim(),
                apiKeyEnv: apiKeyEnv.trim() || undefined,
                apiKey: apiKey.trim() ? apiKey.trim() : undefined,
                systemPrompt: systemPrompt.trim() || undefined,
                requestStyle,
            },
        });
    }
    function handleLocaleChange(next) {
        setLocale(next);
        writeStoredLocale(next);
        i18n.changeLanguage(next);
    }
    const Label = ({ children, hint }) => (_jsxs("div", { className: "mb-2", children: [_jsx("span", { className: "text-sm font-medium text-ink-900", children: children }), hint && _jsx("p", { className: "mt-0.5 text-xs text-ink-500", children: hint })] }));
    return (_jsxs("div", { className: "flex gap-8", children: [_jsx("aside", { className: "hidden md:block", children: _jsx(SettingsNav, { items: SETTINGS_SECTIONS }) }), _jsxs("div", { className: "flex-1 space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-semibold leading-tight tracking-heading text-ink-900", style: { fontSize: '32px' }, children: t('settings.title') }), _jsx("p", { className: "mt-1.5 text-sm text-ink-500", children: t('settings.subtitle') })] }), _jsx("section", { id: "language", className: "scroll-mt-24", children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: t('settings.language.title') }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsx("p", { className: "text-xs text-ink-500", children: t('settings.language.description') }), _jsxs("label", { className: "block", children: [_jsx(Label, { children: t('settings.language.label') }), _jsxs("select", { className: "flex h-9 w-full max-w-xs rounded-md bg-white px-3 text-sm text-ink-900 shadow-ring-light transition-all hover:shadow-border", value: locale, onChange: (e) => handleLocaleChange(e.target.value), children: [_jsx("option", { value: "zh", children: t('settings.language.options.zh') }), _jsx("option", { value: "en", children: t('settings.language.options.en') })] })] })] })] }) }), _jsx("section", { id: "ai-config", className: "scroll-mt-24", children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: t('settings.ai.title') }) }), _jsxs(CardContent, { className: "space-y-5", children: [_jsxs("label", { className: "block", children: [_jsx(Label, { hint: t('settings.ai.requestStyleHint'), children: t('settings.ai.requestStyle') }), _jsxs("select", { className: "flex h-9 w-full rounded-md bg-white px-3 text-sm text-ink-900 shadow-ring-light transition-all hover:shadow-border", value: requestStyle, onChange: e => setRequestStyle(e.target.value), children: [_jsx("option", { value: "openai", children: "openai (chat/completions)" }), _jsx("option", { value: "anthropic", children: "anthropic (messages)" })] })] }), _jsxs("label", { className: "block", children: [_jsx(Label, { children: t('settings.ai.endpoint') }), _jsx(Input, { className: "font-mono text-xs", value: endpoint, onChange: e => setEndpoint(e.target.value), placeholder: "https://api.openai.com/v1/chat/completions" })] }), _jsxs("label", { className: "block", children: [_jsx(Label, { children: t('settings.ai.model') }), _jsx(Input, { className: "font-mono text-xs", value: model, onChange: e => setModel(e.target.value), placeholder: "gpt-4o-mini or claude-sonnet-4-6" })] }), _jsxs("label", { className: "block", children: [_jsx(Label, { hint: t('settings.ai.apiKeyEnvHint'), children: t('settings.ai.apiKeyEnv') }), _jsx(Input, { className: "font-mono text-xs", value: apiKeyEnv, onChange: e => setApiKeyEnv(e.target.value), placeholder: "OPENAI_API_KEY" })] }), _jsxs("label", { className: "block", children: [_jsx(Label, { hint: t('settings.ai.apiKeyHint'), children: t('settings.ai.apiKey') }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { type: showKey ? 'text' : 'password', value: apiKey, onChange: e => setApiKey(e.target.value), placeholder: "sk-\u2026", className: "font-mono text-xs" }), _jsx(Button, { variant: "secondary", onClick: () => setShowKey(s => !s), children: showKey ? t('common.hide') : t('common.show') })] })] }), _jsxs("label", { className: "block", children: [_jsx(Label, { hint: t('settings.ai.systemPromptHint'), children: t('settings.ai.systemPrompt') }), _jsx("textarea", { className: "flex w-full rounded-md bg-white p-3 text-sm text-ink-900 shadow-ring-light transition-all hover:shadow-border", rows: 5, value: systemPrompt, onChange: e => setSystemPrompt(e.target.value) })] }), _jsxs("div", { className: "flex items-center gap-3 pt-2", children: [_jsx(Button, { onClick: handleSave, disabled: save.isPending, children: save.isPending ? t('common.saving') : t('common.save') }), _jsx(Button, { variant: "secondary", onClick: () => test.mutate(), disabled: test.isPending, children: test.isPending ? t('settings.ai.testing') : t('settings.ai.testConnection') }), test.data && (test.data.ok
                                                    ? _jsx(Badge, { variant: "success", children: t('settings.ai.testOk', { latency: test.data.latencyMs }) })
                                                    : _jsx(Badge, { variant: "destructive", children: t('settings.ai.testFail') }))] }), test.data && !test.data.ok && (_jsx("p", { className: "font-mono text-xs text-ship-red", children: test.data.error }))] })] }) }), _jsx("section", { id: "user-skills-dir", className: "scroll-mt-24", children: _jsx(UserSkillsDirCard, {}) }), _jsx("section", { id: "scan-paths", className: "scroll-mt-24", children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: t('settings.scanPaths.title') }) }), _jsxs(CardContent, { children: [_jsx("p", { className: "mb-3 text-xs text-ink-500", children: t('settings.scanPaths.description') }), _jsx("textarea", { className: "flex w-full rounded-md bg-white p-3 font-mono text-xs text-ink-900 shadow-ring-light transition-all hover:shadow-border", rows: 6, value: scanPathsText, onChange: e => setScanPathsText(e.target.value) })] })] }) }), _jsx("section", { id: "platform", className: "scroll-mt-24", children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: t('settings.platform.title') }) }), _jsx(CardContent, { children: platform ? (_jsxs("dl", { className: "grid grid-cols-2 gap-x-6 gap-y-3 text-sm", children: [_jsx("dt", { className: "font-mono text-xs uppercase tracking-tight text-ink-500", children: t('settings.platform.os') }), _jsxs("dd", { className: "font-mono text-xs text-ink-900", children: [platform.os, " ", platform.release, " (", platform.arch, ")"] }), _jsx("dt", { className: "font-mono text-xs uppercase tracking-tight text-ink-500", children: t('settings.platform.node') }), _jsx("dd", { className: "font-mono text-xs text-ink-900", children: platform.node }), _jsx("dt", { className: "font-mono text-xs uppercase tracking-tight text-ink-500", children: t('settings.platform.linkMethod') }), _jsx("dd", { children: _jsx(Badge, { variant: "info", children: platform.linkMethodPreview }) })] })) : _jsx("p", { className: "text-sm text-ink-500", children: t('settings.platform.loading') }) })] }) })] })] }));
}
