// Keep locale writes ordered without hiding an individual caller's failure.
export function createLanguageSaveQueue<T>(persist: (choice: T) => Promise<unknown>) {
  let tail: Promise<void> = Promise.resolve();
  let selected = false;
  return {
    hasSelection: () => selected,
    save(choice: T): Promise<void> {
      selected = true;
      const save = tail.catch(() => {}).then(async () => {
        await persist(choice);
      });
      tail = save;
      return save;
    },
  };
}
