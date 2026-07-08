import { createElement, Fragment, type Key, type ReactNode } from 'react';

export type DataTableColumn = {
  className?: string;
  colClassName?: string;
  header: ReactNode;
  key: Key;
};

type DataTableRowClassName<Item> = string | ((item: Item) => string);
type ListRowElement = 'article' | 'div' | 'li';

type BaseDataTableProps<Item> = {
  className?: string;
  empty?: ReactNode;
  getItemKey: (item: Item) => Key;
  items: readonly Item[];
};

type TableDataTableProps<Item> = BaseDataTableProps<Item> & {
  columns: readonly DataTableColumn[];
  renderCells: (item: Item) => ReactNode;
  rowClassName?: DataTableRowClassName<Item>;
  tableClassName: string;
  variant: 'table';
};

type ListHeaderProps = {
  headAriaHidden?: boolean;
  headClassName?: string;
  header?: ReactNode;
  headers?: readonly ReactNode[];
};

type WrappedListDataTableProps<Item> = BaseDataTableProps<Item> &
  ListHeaderProps & {
    renderItem?: never;
    renderRow: (item: Item) => ReactNode;
    rowClassName: DataTableRowClassName<Item>;
    rowElement?: ListRowElement;
    variant?: 'list';
  };

type CustomListDataTableProps<Item> = BaseDataTableProps<Item> &
  ListHeaderProps & {
    renderItem: (item: Item) => ReactNode;
    renderRow?: never;
    rowClassName?: never;
    rowElement?: never;
    variant?: 'list';
  };

export type DataTableProps<Item> = TableDataTableProps<Item> | WrappedListDataTableProps<Item> | CustomListDataTableProps<Item>;

export function DataTable<Item>(props: DataTableProps<Item>) {
  if (!props.items.length && props.empty !== undefined) {
    return <>{props.empty}</>;
  }

  if (props.variant === 'table') {
    const hasColumnGroup = props.columns.some((column) => column.colClassName);
    return (
      <div className={props.className}>
        <table className={props.tableClassName}>
          {hasColumnGroup ? (
            <colgroup>
              {props.columns.map((column) => (
                <col key={column.key} className={column.colClassName} />
              ))}
            </colgroup>
          ) : null}
          <thead>
            <tr>
              {props.columns.map((column) => (
                <th key={column.key} scope="col" className={column.className}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.items.map((item) => (
              <tr key={props.getItemKey(item)} className={resolveRowClassName(props.rowClassName, item)}>
                {props.renderCells(item)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={props.className}>
      {renderListHeader(props)}
      {props.items.map((item) => {
        const itemKey = props.getItemKey(item);
        if (props.renderItem) {
          return createElement(Fragment, { key: itemKey }, props.renderItem(item));
        }
        const RowElement = props.rowElement || 'article';
        return createElement(
          RowElement,
          {
            className: resolveRowClassName(props.rowClassName, item),
            key: itemKey
          },
          props.renderRow(item)
        );
      })}
    </div>
  );
}

function renderListHeader<Item>(props: WrappedListDataTableProps<Item> | CustomListDataTableProps<Item>) {
  if (props.header !== undefined) {
    return <>{props.header}</>;
  }

  if (!props.headers?.length) {
    return null;
  }

  return (
    <div className={props.headClassName} aria-hidden={props.headAriaHidden || undefined}>
      {props.headers.map((header, headerIndex) => (
        <span key={headerIndex}>{header}</span>
      ))}
    </div>
  );
}

function resolveRowClassName<Item>(className: DataTableRowClassName<Item> | undefined, item: Item) {
  return typeof className === 'function' ? className(item) : className;
}
