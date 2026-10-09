import { createContext, useContext, useState, useEffect, type Dispatch, type SetStateAction, type ReactNode } from "react";

export interface PageContextEntry {
  label: string;    // Short chip label, e.g. "Run: Login SSO"
  context: string;  // Full detail string sent to the model
}

interface OperatorPageContextValue {
  pageContext: PageContextEntry | null;
  setPageContext: (ctx: PageContextEntry | null) => void;
  popupMounted: boolean;
  setPopupMounted: Dispatch<SetStateAction<boolean>>;
  popupOpen: boolean;
  setPopupOpen: Dispatch<SetStateAction<boolean>>;
  popupView: "chat" | "history";
  setPopupView: Dispatch<SetStateAction<"chat" | "history">>;
}

export const OperatorPageContext = createContext<OperatorPageContextValue>({
  pageContext: null,
  setPageContext: () => {},
  popupMounted: false,
  setPopupMounted: () => {},
  popupOpen: false,
  setPopupOpen: () => {},
  popupView: "chat",
  setPopupView: () => {},
});

export function OperatorPageContextProvider({ children }: { children: ReactNode }) {
  const [pageContext, setPageContext] = useState<PageContextEntry | null>(null);
  const [popupMounted, setPopupMounted] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupView, setPopupView] = useState<"chat" | "history">("chat");
  return (
    <OperatorPageContext.Provider value={{
      pageContext, setPageContext,
      popupMounted, setPopupMounted,
      popupOpen, setPopupOpen,
      popupView, setPopupView,
    }}>
      {children}
    </OperatorPageContext.Provider>
  );
}

// Hook for pages to publish their context — clears automatically on unmount
export function useSetOperatorContext(entry: PageContextEntry | null) {
  const { setPageContext } = useContext(OperatorPageContext);
  useEffect(() => {
    setPageContext(entry);
    return () => setPageContext(null);
  }, [entry?.label, entry?.context]); // eslint-disable-line react-hooks/exhaustive-deps
}
