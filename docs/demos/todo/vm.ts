import { ViewModelBase } from 'bizify';

export interface Todo {
  id: string;
  text: string;
  done: boolean;
}

export type Filter = 'all' | 'active' | 'done';

export type TodoState = {
  items: Todo[];
  filter: Filter;
  draft: string;
  // computed
  readonly visibleItems: Todo[];
  readonly remaining: number;
};

export class TodoVM extends ViewModelBase<TodoState> {
  protected $data(): TodoState {
    return {
      items: [
        { id: '1', text: '试试 bizify', done: false },
        { id: '2', text: '看看自动追踪', done: true },
      ],
      filter: 'all',
      draft: '',

      get visibleItems() {
        if (this.filter === 'active') return this.items.filter((t) => !t.done);
        if (this.filter === 'done') return this.items.filter((t) => t.done);
        return this.items;
      },

      get remaining() {
        return this.items.filter((t) => !t.done).length;
      },
    };
  }

  setDraft(draft: string) {
    this.data.draft = draft;
  }

  setFilter(filter: Filter) {
    this.data.filter = filter;
  }

  add() {
    const text = this.data.draft.trim();
    if (!text) return;
    this.data.items.push({ id: String(Date.now()), text, done: false });
    this.data.draft = '';
  }

  toggle(id: string) {
    const item = this.data.items.find((t) => t.id === id);
    if (item) item.done = !item.done;
  }

  remove(id: string) {
    const idx = this.data.items.findIndex((t) => t.id === id);
    if (idx >= 0) this.data.items.splice(idx, 1);
  }
}
