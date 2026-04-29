import { WindowControl } from "@renderer/components/window-control";
import { MainLayout } from "./main";

export const Layout = () => {
  return (
    <div className="h-full  flex flex-col">
      <WindowControl />
      <div className="h-full border  p-4">
        <MainLayout />
      </div>
    </div>
  )
};
