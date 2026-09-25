import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import type { FsStep } from '../../api/client.types';
import { useIndex } from '../../app/IndexProvider';
import { PlanDialog } from '../PlanDialog';
import { FOCUS_COMMAND_BAR_EVENT, RESULT_COUNT_EVENT } from './command-bar.constants';
import { KeyHint } from '../shell/KeyHint';
import { useToast } from '../Toaster';
import type { CommandContext, CommandDefinition, MenuOption, PickedValue } from './command-bar.types';
import { buildCommands, optionsFor } from './commands';
import { CommandMenu } from './CommandMenu';
import { FilterChips } from './FilterChips';

interface PendingPlan {
  title: string;
  steps: FsStep[];
  command: CommandDefinition;
  values: PickedValue[];
}

export function CommandBar() {
  const { index, refresh } = useIndex();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({ path: '', value: '', query: '', key: '' });
  const [focused, setFocused] = useState(false);
  const [command, setCommand] = useState<CommandDefinition | null>(null);
  const [values, setValues] = useState<PickedValue[]>([]);
  const [active, setActive] = useState(0);
  const [plan, setPlan] = useState<PendingPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultCount, setResultCount] = useState(0);
  const onSkills = location.pathname === '/skills';
  const urlQuery = params.get('q') ?? '';
  let text = '';
  if (draft.path === location.pathname) {
    text = draft.value;
  }
  // The bar marks its own URL writes; any other navigation (back/forward, a link) hands the text back to ?q=.
  const fromBar = (location.state as { fromBar?: boolean } | null)?.fromBar === true;
  const typedHere = draft.key === location.key;
  let urlOwnsText = !fromBar && !typedHere;
  if (fromBar && draft.query !== urlQuery) {
    urlOwnsText = true;
  }
  if (onSkills && !command && !text.startsWith('/') && urlOwnsText) {
    text = urlQuery;
  }
  const setText = (value: string) => setDraft({ path: location.pathname, value, query: urlQuery, key: location.key });

  useEffect(() => {
    const focusBar = () => inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (document.querySelector('dialog[open]')) {
          return;
        }
        event.preventDefault();
        focusBar();
      }
    };
    const onCount = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === 'number') {
        setResultCount(event.detail);
      }
    };
    window.addEventListener(RESULT_COUNT_EVENT, onCount);
    window.addEventListener('keydown', onKey);
    window.addEventListener(FOCUS_COMMAND_BAR_EVENT, focusBar);
    return () => {
      window.removeEventListener(RESULT_COUNT_EVENT, onCount);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(FOCUS_COMMAND_BAR_EVENT, focusBar);
    };
  }, []);

  const commands = useMemo(() => {
    if (!index) {
      return [];
    }
    return buildCommands(index);
  }, [index]);

  if (!index) {
    return null;
  }

  const context: CommandContext = {
    index,
    navigate,
    refresh,
    setParam: (key, value) => {
      const next = new URLSearchParams(params);
      next.set(key, value);
      setParams(next);
    }
  };

  const reset = () => {
    setCommand(null);
    setValues([]);
    setText('');
    setActive(0);
  };

  const setSearch = (value: string) => {
    setActive(0);
    if (command || value.startsWith('/') || !onSkills) {
      setText(value);
      return;
    }
    let writtenQuery = '';
    if (value.trim().length > 0) {
      writtenQuery = value;
    }
    setDraft({ path: location.pathname, value, query: writtenQuery, key: location.key });
    const next = new URLSearchParams(params);
    if (value.trim().length > 0) {
      next.set('q', value);
    } else {
      next.delete('q');
    }
    setParams(next, { replace: true, state: { fromBar: true } });
  };

  const step = command?.steps[values.length];
  const needle = text.trim().toLowerCase();
  let menuTitle = '';
  let menuMeta = '';
  let footerStart = ['↑↓ to move', '↵ to choose', 'esc to go back'];
  let footerEnd = '';
  const options: MenuOption[] = [];
  if (command && step && step.kind !== 'text') {
    menuTitle = step.title;
    for (const option of optionsFor(step.kind, index, needle, values)) {
      options.push(option);
    }
    if (step.kind === 'agent') {
      let available = 0;
      let linked = 0;
      for (const option of options) {
        if (option.meta === 'Already linked') {
          linked += 1;
        }
        if (option.meta === 'Detected') {
          available += 1;
        }
      }
      menuMeta = `${available} available · ${linked} already linked`;
    }
    if (values.length + 1 === command.steps.length && command.mutate) {
      footerStart = ['↵ preview changes', 'esc back'];
      footerEnd = 'Nothing is written until you apply';
    }
  } else if (!command && text.startsWith('/')) {
    menuTitle = 'Commands';
    const commandNeedle = text.slice(1).toLowerCase();
    for (const definition of commands) {
      if (definition.id.startsWith(commandNeedle) || definition.summary.includes(commandNeedle)) {
        options.push({ id: definition.id, label: `${definition.id} — ${definition.summary}`, meta: '', icon: 'command' });
      }
    }
  } else if (!command && !onSkills && needle.length > 0 && focused) {
    menuTitle = 'Skills';
    menuMeta = 'Type / for commands';
    footerStart = ['↵ to open'];
    for (const option of optionsFor('skill', index, needle, values)) {
      options.push(option);
    }
  }
  const MENU_LIMIT = 8;
  const shownOptions: MenuOption[] = [];
  for (const option of options) {
    if (shownOptions.length < MENU_LIMIT) {
      shownOptions.push(option);
    }
  }
  const menuOpen = focused && menuTitle.length > 0;

  const runCommand = async (definition: CommandDefinition, picked: PickedValue[]) => {
    setBusy(true);
    try {
      if (definition.mutate) {
        const preview = await definition.mutate(picked, true);
        let title = `/${definition.id}`;
        for (const value of picked) {
          title += ` ${value.label}`;
        }
        setPlan({ title, steps: preview.steps, command: definition, values: picked });
        return;
      }
      if (definition.act) {
        const message = await definition.act(picked, context);
        if (message.length > 0) {
          toast.push(message, 'ok');
        }
        reset();
      }
    } catch (cause) {
      toast.push(errorMessage(cause, `/${definition.id} failed`), 'error');
      // Step back one so the last choice can be edited and the command retried.
      setValues(picked.slice(0, -1));
    } finally {
      setBusy(false);
    }
  };

  const advance = (definition: CommandDefinition, picked: PickedValue[]) => {
    setValues(picked);
    setText('');
    setActive(0);
    if (picked.length === definition.steps.length) {
      void runCommand(definition, picked);
    }
  };

  const pick = (option: MenuOption) => {
    if (!command && text.startsWith('/')) {
      for (const definition of commands) {
        if (definition.id === option.id) {
          setCommand(definition);
          advance(definition, []);
        }
      }
      return;
    }
    if (command) {
      const picked = [...values, { id: option.id, label: option.label }];
      advance(command, picked);
      return;
    }
    reset();
    navigate(`/skills/${encodeURIComponent(option.id)}`);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && shownOptions.length > 0) {
      event.preventDefault();
      setActive((active + 1) % shownOptions.length);
      return;
    }
    if (event.key === 'ArrowUp' && shownOptions.length > 0) {
      event.preventDefault();
      setActive((active - 1 + shownOptions.length) % shownOptions.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (command && step && step.kind === 'text' && text.trim().length > 0) {
        advance(command, [...values, { id: text.trim(), label: text.trim() }]);
        return;
      }
      const chosen = shownOptions[Math.min(active, shownOptions.length - 1)];
      if (chosen) {
        pick(chosen);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (command && values.length > 0) {
        setValues(values.slice(0, -1));
        return;
      }
      if (command || text.length > 0) {
        reset();
        setSearch('');
        return;
      }
      inputRef.current?.blur();
    }
  };

  const apply = async () => {
    if (!plan || !plan.command.mutate) {
      return;
    }
    setBusy(true);
    try {
      await plan.command.mutate(plan.values, false);
      refresh();
      toast.push('Done. Type /undo to revert.', 'ok');
      setPlan(null);
      reset();
    } catch (cause) {
      toast.push(errorMessage(cause, 'apply failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const cancelPlan = () => {
    setPlan(null);
    setValues(values.slice(0, -1));
    inputRef.current?.focus();
  };

  let placeholder = 'Search skills, or type / for commands';
  if (step) {
    placeholder = step.prompt;
  }
  let barClass = 'shell-command-bar';
  if (command) {
    barClass += ' is-command';
  } else if (focused && text.length > 0) {
    barClass += ' is-searching';
  }
  let resultMeta = '';
  if (!command && onSkills && needle.length > 0 && !text.startsWith('/')) {
    resultMeta = `${resultCount} results`;
    if (resultCount === 1) {
      resultMeta = '1 result';
    }
  }
  if (command) {
    resultMeta = `Step ${Math.min(values.length + 1, command.steps.length)} of ${command.steps.length}`;
  }

  const tokens: ReactNode[] = [];
  if (command) {
    values.forEach((value, position) => {
      const connector = command.steps[position]?.connector;
      if (connector) {
        tokens.push(<span className="shell-command-connector" key={`c-${position}`}>{connector}</span>);
      }
      tokens.push(<span className="shell-command-token" key={`v-${position}`}>{value.label}</span>);
    });
    if (step?.connector) {
      tokens.push(<span className="shell-command-connector" key="c-current">{step.connector}</span>);
    }
  }
  let hints = ['↑↓ to move', '↵ to open', '/ commands', 'esc to clear'];
  if (command) {
    hints = ['↑↓ to move', '↵ to preview', 'esc back one step'];
  }

  return (
    <div className="shell-command-area">
      {menuOpen && <CommandMenu title={menuTitle} meta={menuMeta} options={shownOptions} activeIndex={Math.min(active, Math.max(0, shownOptions.length - 1))} onPick={pick} footerStart={footerStart} footerEnd={footerEnd} />}
      {!menuOpen && onSkills && <FilterChips index={index} />}
      <div className={barClass}>
        {!command && <Search aria-hidden="true" />}
        {command && <span className="shell-command-token is-command">{`/${command.id}`}</span>}
        {tokens}
        <input ref={inputRef} className="shell-command-input" value={text} placeholder={placeholder} aria-label="Search skills or run a command" disabled={busy} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={(event) => setSearch(event.target.value)} onKeyDown={onKeyDown} />
        {resultMeta.length > 0 && <span className="shell-command-meta">{resultMeta}</span>}
        {!command && text.length === 0 && <><KeyHint>/</KeyHint><KeyHint>⌘K</KeyHint></>}
        {!command && text.length > 0 && <KeyHint>esc</KeyHint>}
      </div>
      <div className="shell-command-hints">{hints.map((hint) => <span key={hint}>{hint}</span>)}</div>
      {plan && <PlanDialog title={plan.title} steps={plan.steps} busy={busy} onConfirm={() => void apply()} onCancel={cancelPlan} />}
    </div>
  );
}
