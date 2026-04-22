import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useSettings, useSaveSettings } from '@/api/settings';
import { usePlatform } from '@/api/platform';
import { useOpenUserSkillsDir } from '@/api/user-skills-dir';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export function UserSkillsDirCard() {
    const { t } = useTranslation();
    const { data: settings } = useSettings();
    const { data: platform } = usePlatform();
    const save = useSaveSettings();
    const open = useOpenUserSkillsDir();
    const [path, setPath] = useState('');
    const [err, setErr] = useState(null);
    const [saved, setSaved] = useState(false);
    useEffect(() => {
        const current = settings?.userSkillsDir ?? platform?.userSkillsDir ?? '';
        setPath(current);
    }, [settings, platform]);
    const effectivePath = settings?.userSkillsDir ?? platform?.userSkillsDir ?? '';
    const copyCommand = `claude "use skill-creator to create <skill-name> in ${effectivePath}"`;
    async function handleSave() {
        setErr(null);
        setSaved(false);
        try {
            await save.mutateAsync({ userSkillsDir: path.trim() });
            setSaved(true);
        }
        catch (e) {
            setErr(e.message);
        }
    }
    async function copyCmd() {
        await navigator.clipboard.writeText(copyCommand);
    }
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: t('settings.userSkills.title') }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsx("p", { className: "text-xs text-ink-500", children: _jsx(Trans, { i18nKey: "settings.userSkills.cardDescription", components: { code: _jsx("code", { className: "font-mono" }) } }) }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { className: "font-mono text-xs", value: path, onChange: e => setPath(e.target.value), placeholder: "/home/you/.loom/skills" }), _jsx(Button, { onClick: handleSave, disabled: save.isPending || path.trim() === effectivePath, children: save.isPending ? t('common.saving') : t('common.save') }), _jsx(Button, { variant: "secondary", onClick: () => open.mutate(), disabled: open.isPending, children: open.isPending ? t('common.opening') : t('settings.userSkills.openFolder') })] }), err && _jsx("p", { className: "text-xs text-ship-red", children: err }), saved && _jsx("p", { className: "text-xs text-badge-green-text", children: t('settings.userSkills.saved') }), open.error && _jsx("p", { className: "text-xs text-ship-red", children: open.error.message }), _jsxs("div", { className: "rounded-lg bg-ink-50 p-3 shadow-ring-light", children: [_jsx("p", { className: "mb-2 text-xs font-medium text-ink-900", children: t('settings.userSkills.createTitle') }), _jsxs("ol", { className: "space-y-1 text-xs text-ink-600", children: [_jsxs("li", { children: [t('settings.userSkills.createStep1Prefix'), _jsx("code", { className: "font-mono", children: "<skill-name>" }), t('settings.userSkills.createStep1Suffix')] }), _jsxs("li", { children: [t('settings.userSkills.createStep2Prefix'), _jsx("strong", { children: t('settings.userSkills.createStep2Bold') }), t('settings.userSkills.createStep2Suffix')] })] }), _jsx("pre", { className: "mt-3 overflow-x-auto rounded bg-white p-2 font-mono text-xs text-ink-900 shadow-ring-light", children: copyCommand }), _jsx(Button, { size: "sm", variant: "secondary", className: "mt-2", onClick: copyCmd, children: t('settings.userSkills.copyCommand') })] })] })] }));
}
